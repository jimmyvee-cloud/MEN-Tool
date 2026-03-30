"""JSON-driven inference engine — evaluates weighted rule modules against
precomputed user metrics to produce scored insight cards."""

from __future__ import annotations

import json
import logging
import operator
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

_RULES_DIR = Path(__file__).resolve().parent / "inference_rules"

_OPS: dict[str, Any] = {
    ">=": operator.ge,
    "<=": operator.le,
    ">": operator.gt,
    "<": operator.lt,
    "==": operator.eq,
    "!=": operator.ne,
}

# ---------------------------------------------------------------------------
# Rule loading (cached at module level, auto-discovers *.json)
# ---------------------------------------------------------------------------

_cached_modules: list[dict] | None = None


def load_rules(*, force: bool = False) -> list[dict]:
    global _cached_modules
    if _cached_modules is not None and not force:
        return _cached_modules
    modules: list[dict] = []
    if not _RULES_DIR.is_dir():
        log.warning("inference_rules directory not found at %s", _RULES_DIR)
        _cached_modules = modules
        return modules
    for path in sorted(_RULES_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if "module" in data and "rules" in data:
                modules.append(data)
        except Exception:
            log.exception("Failed to load rule file %s", path)
    _cached_modules = modules
    return modules


# ---------------------------------------------------------------------------
# Metrics computation
# ---------------------------------------------------------------------------

def _day_key(iso: str) -> str:
    return iso[:10] if iso else ""


def _active(items: list[dict]) -> list[dict]:
    return [x for x in items if not x.get("is_deleted")]


def _in_window(day_str: str, win_start: date, win_end: date) -> bool:
    try:
        d = date.fromisoformat(day_str)
        return win_start <= d <= win_end
    except ValueError:
        return False


def _top_from_counter(counter: dict[str, int]) -> tuple[str, int]:
    if not counter:
        return ("", 0)
    top = max(counter, key=counter.get)  # type: ignore[arg-type]
    return (top, counter[top])


def _mood_trend(by_day_avg: dict[str, float], win_start: date, win_end: date) -> float:
    """Simple linear slope of daily average mood across the window.
    Returns 0.0 when there are fewer than 2 data points."""
    points: list[tuple[int, float]] = []
    d = win_start
    i = 0
    while d <= win_end:
        key = d.isoformat()
        if key in by_day_avg:
            points.append((i, by_day_avg[key]))
        d += timedelta(days=1)
        i += 1
    if len(points) < 2:
        return 0.0
    n = len(points)
    sx = sum(p[0] for p in points)
    sy = sum(p[1] for p in points)
    sxy = sum(p[0] * p[1] for p in points)
    sx2 = sum(p[0] ** 2 for p in points)
    denom = n * sx2 - sx * sx
    if denom == 0:
        return 0.0
    return round((n * sxy - sx * sy) / denom, 4)


def compute_metrics(
    checkins: list[dict],
    stressors: list[dict],
    reliefs: list[dict],
    win_start: date,
    win_end: date,
) -> dict[str, Any]:
    window_days = (win_end - win_start).days + 1

    # --- filter to active + in-window ---------------------------------
    ci = [
        c for c in _active(checkins)
        if _in_window(_day_key(c.get("logged_at", "")), win_start, win_end)
    ]
    st = [
        s for s in _active(stressors)
        if _in_window(_day_key(s.get("logged_at", "")), win_start, win_end)
    ]
    rl = [
        r for r in _active(reliefs)
        if _in_window(_day_key(r.get("logged_at", "")), win_start, win_end)
    ]

    # --- checkin metrics ----------------------------------------------
    moods = [int(c.get("mood_score", 0)) for c in ci]
    checkin_count = len(ci)
    avg_mood: float | None = round(sum(moods) / len(moods), 2) if moods else None

    by_day_mood: dict[str, list[int]] = defaultdict(list)
    for c in ci:
        by_day_mood[_day_key(c.get("logged_at", ""))].append(int(c.get("mood_score", 0)))
    daily_avg_mood = {k: sum(v) / len(v) for k, v in by_day_mood.items()}

    mood_low_day_count = sum(1 for v in daily_avg_mood.values() if v <= 3)
    mood_high_day_count = sum(1 for v in daily_avg_mood.values() if v >= 7)
    mood_trend = _mood_trend(daily_avg_mood, win_start, win_end)

    # --- stressor metrics ---------------------------------------------
    stressor_count = len(st)
    intensities = [int(s.get("intensity", 0)) for s in st]
    stressor_avg_intensity = (
        round(sum(intensities) / len(intensities), 2) if intensities else 0.0
    )
    stressor_high_intensity_count = sum(1 for i in intensities if i >= 7)

    stressor_cats: dict[str, int] = defaultdict(int)
    for s in st:
        cat = (s.get("category") or "").strip().lower()
        if cat:
            stressor_cats[cat] += 1
    stressor_top_cat, stressor_top_cat_count = _top_from_counter(dict(stressor_cats))

    # --- relief metrics -----------------------------------------------
    relief_count = len(rl)
    eff_vals = [int(r.get("effectiveness", 0)) for r in rl]
    focus_vals = [int(r.get("focus", 0)) for r in rl]
    relief_avg_effectiveness = (
        round(sum(eff_vals) / len(eff_vals), 2) if eff_vals else 0.0
    )
    relief_avg_focus = (
        round(sum(focus_vals) / len(focus_vals), 2) if focus_vals else 0.0
    )

    relief_cats: dict[str, int] = defaultdict(int)
    for r in rl:
        cat = (r.get("category") or "").strip().lower()
        if cat:
            relief_cats[cat] += 1
    relief_top_cat, relief_top_cat_count = _top_from_counter(dict(relief_cats))

    # --- activity metrics ---------------------------------------------
    active_day_set: set[str] = set()
    for item in (*ci, *st, *rl):
        dk = _day_key(item.get("logged_at", ""))
        if dk:
            active_day_set.add(dk)
    active_days = len(active_day_set)
    silent_days = window_days - active_days
    total_logs = checkin_count + stressor_count + relief_count
    logs_per_day = round(total_logs / max(window_days, 1), 2)

    # --- derived ratios -----------------------------------------------
    stressor_to_checkin_ratio = round(stressor_count / max(checkin_count, 1), 2)
    relief_to_checkin_ratio = round(relief_count / max(checkin_count, 1), 2)
    relief_to_stressor_ratio = round(relief_count / max(stressor_count, 1), 2)

    return {
        "avg_mood": avg_mood if avg_mood is not None else 0,
        "mood_trend": mood_trend,
        "mood_low_day_count": mood_low_day_count,
        "mood_high_day_count": mood_high_day_count,
        "checkin_count": checkin_count,
        "stressor_count": stressor_count,
        "stressor_avg_intensity": stressor_avg_intensity,
        "stressor_high_intensity_count": stressor_high_intensity_count,
        "stressor_categories": dict(stressor_cats),
        "stressor_top_category": stressor_top_cat,
        "stressor_top_category_count": stressor_top_cat_count,
        "stressor_to_checkin_ratio": stressor_to_checkin_ratio,
        "relief_count": relief_count,
        "relief_avg_effectiveness": relief_avg_effectiveness,
        "relief_avg_focus": relief_avg_focus,
        "relief_categories": dict(relief_cats),
        "relief_top_category": relief_top_cat,
        "relief_top_category_count": relief_top_cat_count,
        "relief_to_checkin_ratio": relief_to_checkin_ratio,
        "relief_to_stressor_ratio": relief_to_stressor_ratio,
        "active_days": active_days,
        "silent_days": silent_days,
        "total_logs": total_logs,
        "logs_per_day": logs_per_day,
        "window_days": window_days,
    }


# ---------------------------------------------------------------------------
# Rule evaluation
# ---------------------------------------------------------------------------

def _eval_condition(cond: dict, metrics: dict[str, Any]) -> bool:
    metric_name = cond.get("metric", "")
    op_str = cond.get("op", "")
    target = cond.get("value")
    fn = _OPS.get(op_str)
    if fn is None:
        log.warning("Unknown operator %r in condition", op_str)
        return False
    actual = metrics.get(metric_name)
    if actual is None:
        return False
    try:
        return bool(fn(float(actual), float(target)))
    except (TypeError, ValueError):
        return False


def evaluate_rule(rule: dict, metrics: dict[str, Any]) -> bool:
    conditions = rule.get("conditions", [])
    if not conditions:
        return False
    match_mode = rule.get("match", "all")
    results = [_eval_condition(c, metrics) for c in conditions]
    if match_mode == "any":
        return any(results)
    return all(results)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_inference(
    checkins: list[dict],
    stressors: list[dict],
    reliefs: list[dict],
    win_start: date,
    win_end: date,
) -> list[dict[str, Any]]:
    modules = load_rules()
    if not modules:
        return []
    metrics = compute_metrics(checkins, stressors, reliefs, win_start, win_end)
    cards: list[dict[str, Any]] = []
    for mod in modules:
        module_name = mod.get("module", "unknown")
        module_weight = float(mod.get("module_weight", 1.0))
        for rule in mod.get("rules", []):
            if not evaluate_rule(rule, metrics):
                continue
            score = round(module_weight * float(rule.get("weight", 0.5)), 3)
            cards.append(
                {
                    "kind": "inference",
                    "module": module_name,
                    "rule_id": rule.get("id", ""),
                    "title": rule.get("title", ""),
                    "description": rule.get("message", ""),
                    "severity": rule.get("severity", "info"),
                    "score": score,
                    "tags": rule.get("tags", []),
                }
            )
    cards.sort(key=lambda c: c["score"], reverse=True)
    return cards
