"""7-day insight engine — mood, activity, patterns (no external AI)."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

from app.inference_engine import run_inference
from app.repositories import logs as logs_repo


@dataclass
class WeekWindow:
    start: date
    end: date  # inclusive


def parse_week_start(week_start: str | None) -> date:
    if week_start:
        return date.fromisoformat(week_start[:10])
    today = datetime.now(UTC).date()
    # default: last 7 days ending today
    return today - timedelta(days=6)


def week_window(week_start: date) -> WeekWindow:
    return WeekWindow(start=week_start, end=week_start + timedelta(days=6))


def _day_key(iso: str) -> str:
    return iso[:10] if iso else ""


def _active_logs(items: list[dict]) -> list[dict]:
    return [x for x in items if not x.get("is_deleted")]


def daily_mood_avg(checkins: list[dict], window: WeekWindow) -> list[dict]:
    by_day: dict[str, list[int]] = defaultdict(list)
    for c in _active_logs(checkins):
        d = _day_key(c.get("logged_at", ""))
        if not d:
            continue
        day = date.fromisoformat(d)
        if window.start <= day <= window.end:
            by_day[d].append(int(c.get("mood_score", 0)))
    out = []
    d = window.start
    while d <= window.end:
        key = d.isoformat()
        vals = by_day.get(key, [])
        avg = round(sum(vals) / len(vals), 2) if vals else None
        out.append({"date": key, "avg_mood": avg, "count": len(vals)})
        d += timedelta(days=1)
    return out


def daily_stressor_relief_counts(
    stressors: list[dict], reliefs: list[dict], window: WeekWindow
) -> list[dict]:
    sd = defaultdict(int)
    rd = defaultdict(int)
    for s in _active_logs(stressors):
        d = _day_key(s.get("logged_at", ""))
        if d:
            day = date.fromisoformat(d)
            if window.start <= day <= window.end:
                sd[d] += 1
    for r in _active_logs(reliefs):
        d = _day_key(r.get("logged_at", ""))
        if d:
            day = date.fromisoformat(d)
            if window.start <= day <= window.end:
                rd[d] += 1
    out = []
    d = window.start
    while d <= window.end:
        key = d.isoformat()
        out.append({"date": key, "stressors": sd.get(key, 0), "reliefs": rd.get(key, 0)})
        d += timedelta(days=1)
    return out


def logging_silence_days(
    checkins: list[dict],
    stressors: list[dict],
    reliefs: list[dict],
    window: WeekWindow,
) -> list[str]:
    """Days in window with zero activity (mild negative signal)."""
    active_days: set[str] = set()
    for coll in (checkins, stressors, reliefs):
        for x in _active_logs(coll):
            active_days.add(_day_key(x.get("logged_at", "")))
    silent: list[str] = []
    d = window.start
    while d <= window.end:
        k = d.isoformat()
        if k not in active_days:
            silent.append(k)
        d += timedelta(days=1)
    return silent


def pattern_insights_stressors(stressors: list[dict], window: WeekWindow, min_count: int = 3):
    """Recurring stressor titles in window."""
    counts: dict[str, int] = defaultdict(int)
    intensities: dict[str, list[int]] = defaultdict(list)
    for s in _active_logs(stressors):
        d = _day_key(s.get("logged_at", ""))
        if not d:
            continue
        day = date.fromisoformat(d)
        if not (window.start <= day <= window.end):
            continue
        title = (s.get("title") or "Unknown").strip()
        if not title:
            continue
        key = title.lower()
        counts[key] += 1
        intensities[key].append(int(s.get("intensity", 0)))
    out = []
    for title_lc, c in counts.items():
        if c >= min_count:
            # recover display title from last seen
            title_disp = title_lc
            for s in _active_logs(stressors):
                if (s.get("title") or "").strip().lower() == title_lc:
                    title_disp = s.get("title") or title_disp
                    break
            avg_i = sum(intensities[title_lc]) / len(intensities[title_lc])
            out.append(
                {
                    "kind": "pattern_stressor",
                    "title": f"{title_disp} keeps coming up",
                    "description": f"This has appeared {c} times in your log. Might be worth a closer look.",
                    "severity_hint": round(avg_i, 1),
                }
            )
    return out


def relief_mood_correlation(
    checkins: list[dict], reliefs: list[dict], window: WeekWindow
) -> list[dict]:
    """
    Per-relief (preset_id or title): average mood change in following 24h, weighted by focus.
    Simplified: compare average mood of check-ins on same day after relief vs window baseline.
    """
    c_active = _active_logs(checkins)
    by_day_mood: dict[str, list[int]] = defaultdict(list)
    for c in c_active:
        by_day_mood[_day_key(c.get("logged_at", ""))].append(int(c.get("mood_score", 0)))
    daily_avg = {k: sum(v) / len(v) for k, v in by_day_mood.items()}
    baseline_vals = [v for k, v in daily_avg.items() if _in_window(k, window)]
    baseline = sum(baseline_vals) / len(baseline_vals) if baseline_vals else 0

    groups: dict[str, list[tuple[float, int]]] = defaultdict(list)  # weight, delta
    for r in _active_logs(reliefs):
        d = _day_key(r.get("logged_at", ""))
        if not d or not _in_window(d, window):
            continue
        day = date.fromisoformat(d)
        next_day = (day + timedelta(days=1)).isoformat()
        focus = max(1, int(r.get("focus", 5)))
        w = focus / 10.0
        key = r.get("preset_id") or (r.get("title") or "").strip() or "custom"
        m_next = daily_avg.get(next_day)
        m_same = daily_avg.get(d)
        if m_next is not None:
            delta = m_next - baseline
            groups[key].append((w, delta))
        elif m_same is not None:
            delta = m_same - baseline
            groups[key].append((w * 0.5, delta))

    out = []
    for key, pairs in groups.items():
        if not pairs:
            continue
        num = sum(w * d for w, d in pairs)
        den = sum(w for w, _ in pairs)
        score = round(num / den, 2) if den else 0
        if score > 0.25:
            out.append(
                {
                    "kind": "relief_correlation",
                    "title": "Relief linked to better mood",
                    "description": f"'{key}' tends to line up with upward mood in your week (weighted by focus).",
                    "score": score,
                }
            )
    return out


def _in_window(day_str: str, window: WeekWindow) -> bool:
    try:
        d = date.fromisoformat(day_str)
        return window.start <= d <= window.end
    except ValueError:
        return False


def seven_day_mood_improvement_streak(checkins: list[dict]) -> bool:
    """Trending Up: each day's average strictly higher than previous for 7 consecutive days."""
    # Use last 14 days of data to find a run ending today
    by_day: dict[str, list[int]] = defaultdict(list)
    for c in _active_logs(checkins):
        by_day[_day_key(c.get("logged_at", ""))].append(int(c.get("mood_score", 0)))
    if not by_day:
        return False
    days_sorted = sorted(by_day.keys())
    avgs = []
    for d in days_sorted:
        v = by_day[d]
        avgs.append((d, sum(v) / len(v)))
    if len(avgs) < 7:
        return False
    for i in range(len(avgs) - 6):
        window_slice = avgs[i : i + 7]
        ok = True
        for j in range(1, 7):
            if window_slice[j][1] <= window_slice[j - 1][1]:
                ok = False
                break
        if ok:
            return True
    return False


def build_insight_bundle(
    tenant_id: str, user_id: str, week_start: str | None
) -> dict[str, Any]:
    ws = parse_week_start(week_start)
    win = week_window(ws)
    checkins = logs_repo.list_checkins(tenant_id, user_id)
    stressors = logs_repo.list_stressors(tenant_id, user_id)
    reliefs = logs_repo.list_reliefs(tenant_id, user_id)

    mood_series = daily_mood_avg(checkins, win)
    sr_series = daily_stressor_relief_counts(stressors, reliefs, win)
    silent = logging_silence_days(checkins, stressors, reliefs, win)
    patterns = pattern_insights_stressors(stressors, win, min_count=3)
    corr = relief_mood_correlation(checkins, reliefs, win)

    cards: list[dict] = []
    cards.extend(patterns)
    cards.extend(corr)
    if silent:
        cards.append(
            {
                "kind": "logging_silence",
                "title": "Quiet days this week",
                "description": f"You had {len(silent)} day(s) with no logs. Light touch — consider a quick check-in.",
                "silent_dates": silent,
            }
        )

    inference_cards = run_inference(checkins, stressors, reliefs, win.start, win.end)
    cards.extend(inference_cards)

    return {
        "week_start": win.start.isoformat(),
        "week_end": win.end.isoformat(),
        "charts": {
            "daily_mood_average": mood_series,
            "stressors_vs_reliefs": sr_series,
        },
        "insight_cards": cards,
        "signals": {
            "logging_silence_days": silent,
            "trending_up_eligible": seven_day_mood_improvement_streak(checkins),
        },
    }
