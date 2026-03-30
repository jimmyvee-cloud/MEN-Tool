"""Evaluate and grant badges after writes."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from app.insights import seven_day_mood_improvement_streak
from app.repositories import badges as badges_repo
from app.repositories import logs as logs_repo
from app.repositories import users as users_repo


def _iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _rule_dict(badge_def: dict[str, Any]) -> dict[str, Any]:
    raw = badge_def.get("unlock_rule")
    if isinstance(raw, str) and raw.strip():
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
    tt = badge_def.get("trigger_type")
    te = badge_def.get("trigger_entity")
    tv = int(badge_def.get("trigger_value", 0))
    if tt == "threshold" and te == "any":
        return {"type": "threshold", "entity": "any", "value": tv}
    if tt == "threshold" and te:
        return {"type": "threshold", "entity": te, "value": tv}
    if tt == "streak":
        return {
            "type": "streak",
            "entity": te or "checkin",
            "variant": "mood_improving_7d",
            "value": tv,
        }
    return {}


def _rule_satisfied(rule: dict[str, Any], counts: dict[str, int], checkins: list[dict]) -> bool:
    t = rule.get("type")
    if t == "threshold":
        entity = rule.get("entity")
        val = int(rule.get("value", 0))
        if entity == "any":
            return sum(counts.values()) >= val
        if entity in counts:
            return counts[entity] >= val
        return False
    if t == "streak":
        variant = rule.get("variant") or "mood_improving_7d"
        if variant == "mood_improving_7d" or rule.get("entity") == "checkin":
            return seven_day_mood_improvement_streak(checkins)
        return seven_day_mood_improvement_streak(checkins)
    return False


def evaluate_badges_after_action(
    tenant_id: str, user_id: str, kind: str
) -> list[dict]:
    """kind in checkin|stressor|relief — re-evaluates all active badge rules."""
    _ = kind  # reserved for future incremental eval
    granted: list[dict] = []
    defs = badges_repo.list_badge_defs(tenant_id)
    checkins = logs_repo.list_checkins(tenant_id, user_id)
    stressors = logs_repo.list_stressors(tenant_id, user_id)
    reliefs = logs_repo.list_reliefs(tenant_id, user_id)

    def active(xs: list[dict]) -> list[dict]:
        return [x for x in xs if not x.get("is_deleted")]

    checkins_a = active(checkins)
    stressors_a = active(stressors)
    reliefs_a = active(reliefs)

    counts = {
        "checkin": len(checkins_a),
        "stressor": len(stressors_a),
        "relief": len(reliefs_a),
    }

    for d in defs:
        if not d.get("is_active", True):
            continue
        bid = d.get("badge_id", "")
        if not bid or badges_repo.has_user_badge(tenant_id, user_id, bid):
            continue
        rule = _rule_dict(d)
        if not rule:
            continue
        if _rule_satisfied(rule, counts, checkins_a):
            badges_repo.grant_user_badge(tenant_id, user_id, bid, _iso())
            xp = int(d.get("xp_reward", 0))
            if xp:
                users_repo.increment_xp(tenant_id, user_id, xp)
            granted.append(
                {
                    "badge_id": bid,
                    "title": d.get("title") or "",
                    "unlock_hint": d.get("unlock_hint") or d.get("description") or "",
                    "artwork_url": d.get("artwork_url") or "",
                }
            )
    return granted
