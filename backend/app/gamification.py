"""XP, rank tiers, badge evaluation."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any


def _unlock_rule(payload: dict[str, Any]) -> str:
    return json.dumps(payload, separators=(",", ":"))


# Ordered by min_xp ascending (level index = rank_level 0..20)
RANK_LADDER: list[tuple[int, str, str]] = [
    (0, "civilian", "Civilian"),
    (10, "initiate", "Initiate"),
    (25, "recruit", "Recruit"),
    (50, "cadet", "Cadet"),
    (100, "squire", "Squire"),
    (175, "shield_bearer", "Shield Bearer"),
    (300, "line_holder", "Line Holder"),
    (500, "ironblood", "Ironblood"),
    (800, "battle_disciple", "Battle Disciple"),
    (1200, "field_brother", "Field Brother"),
    (1800, "spartan", "Spartan"),
    (2600, "phalanx_guard", "Phalanx Guard"),
    (3800, "warforged", "Warforged"),
    (5500, "captain_of_iron", "Captain of Iron"),
    (7800, "warlord", "Warlord"),
    (11000, "champion_of_the_line", "Champion of the Line"),
    (15500, "titanbound", "Titanbound"),
    (21500, "storm_bringer", "Storm Bringer"),
    (30000, "demigod_of_discipline", "Demigod of Discipline"),
    (42000, "god_of_the_arena", "God of the Arena"),
    (60000, "ascended_spartan", "Ascended Spartan"),
]


@dataclass
class RankInfo:
    rank_level: int
    rank_title: str
    xp_total: float
    next_rank_title: str | None
    xp_for_current_floor: int
    xp_for_next_floor: int | None
    progress_pct: float


def rank_from_xp(xp_total: float | int) -> RankInfo:
    xp_total = max(0.0, float(xp_total))
    idx = 0
    for i, (floor, _slug, title) in enumerate(RANK_LADDER):
        if xp_total >= floor:
            idx = i
        else:
            break
    floor_xp, _slug, title = RANK_LADDER[idx]
    rank_level = idx
    next_floor: int | None = None
    next_title: str | None = None
    if idx + 1 < len(RANK_LADDER):
        next_floor = RANK_LADDER[idx + 1][0]
        next_title = RANK_LADDER[idx + 1][2]
    span = (next_floor - floor_xp) if next_floor is not None else None
    if span and span > 0:
        progress = (xp_total - floor_xp) / span * 100.0
        progress_pct = min(100.0, max(0.0, progress))
    elif next_floor is None:
        progress_pct = 100.0
    else:
        progress_pct = 0.0
    return RankInfo(
        rank_level=rank_level,
        rank_title=title,
        xp_total=round(xp_total, 2),
        next_rank_title=next_title,
        xp_for_current_floor=floor_xp,
        xp_for_next_floor=next_floor,
        progress_pct=round(progress_pct, 1),
    )


XP_CHECKIN = 5
XP_STRESSOR = 3
XP_RELIEF = 4
XP_TIMEZONE = 5
XP_AVATAR_UPLOAD = 10
XP_FIRST_FOLLOW = 10
XP_REFERRAL = 50
XP_WALL_SELF = 1
XP_WALL_OTHER = 3
XP_MEMBER_PER_DAY = 0.5


def default_badge_defs(tenant_id: str) -> list[dict[str, Any]]:
    from datetime import UTC, datetime

    now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    badges: list[dict[str, Any]] = [
        {
            "badge_id": "badge_checkin_10",
            "catalog_order": 1,
            "title": "Check-in Logger",
            "description": "Log 10 check-ins.",
            "unlock_hint": "10 check-ins completed. You're building a consistent habit!",
            "artwork_url": "/achievements/10-checkins-unlocked.png",
            "unlock_rule": _unlock_rule({"type": "threshold", "entity": "checkin", "value": 10}),
            "trigger_type": "threshold",
            "trigger_entity": "checkin",
            "trigger_value": 10,
            "xp_reward": 25,
            "is_active": True,
        },
        {
            "badge_id": "badge_stressor_10",
            "catalog_order": 2,
            "title": "Stress Tracker",
            "description": "Log 10 stressors.",
            "unlock_hint": "Log 10 stressors to unlock Stress Tracker.",
            "artwork_url": "/achievements/10-stressors.png",
            "unlock_rule": _unlock_rule({"type": "threshold", "entity": "stressor", "value": 10}),
            "trigger_type": "threshold",
            "trigger_entity": "stressor",
            "trigger_value": 10,
            "xp_reward": 25,
            "is_active": True,
        },
        {
            "badge_id": "badge_relief_10",
            "catalog_order": 3,
            "title": "Relief Master",
            "description": "Log 10 relievers.",
            "unlock_hint": "Log 10 relief methods to unlock Relief Master.",
            "artwork_url": "/achievements/10-reliefs.png",
            "unlock_rule": _unlock_rule({"type": "threshold", "entity": "relief", "value": 10}),
            "trigger_type": "threshold",
            "trigger_entity": "relief",
            "trigger_value": 10,
            "xp_reward": 25,
            "is_active": True,
        },
        {
            "badge_id": "badge_stressor_20",
            "catalog_order": 5,
            "title": "Stress Hunter",
            "description": "Log 20 stressors.",
            "unlock_hint": "Log 20 stressors to unlock Stress Hunter.",
            "artwork_url": "/achievements/stress-hunter.png",
            "unlock_rule": _unlock_rule({"type": "threshold", "entity": "stressor", "value": 20}),
            "trigger_type": "threshold",
            "trigger_entity": "stressor",
            "trigger_value": 20,
            "xp_reward": 50,
            "is_active": True,
        },
        {
            "badge_id": "badge_relief_20",
            "catalog_order": 6,
            "title": "Recovery Warrior",
            "description": "Log 20 relievers.",
            "unlock_hint": "Log 20 recovery methods to unlock Recovery Warrior.",
            "artwork_url": "/achievements/badge-recovery-warrior.png",
            "unlock_rule": _unlock_rule({"type": "threshold", "entity": "relief", "value": 20}),
            "trigger_type": "threshold",
            "trigger_entity": "relief",
            "trigger_value": 20,
            "xp_reward": 50,
            "is_active": True,
        },
        {
            "badge_id": "badge_trending_up",
            "catalog_order": 4,
            "title": "Trending Up",
            "description": "7 days of improving daily mood averages.",
            "unlock_hint": "7 days in a row of improving daily mood averages from check-ins.",
            "artwork_url": "/achievements/trending.png",
            "unlock_rule": _unlock_rule(
                {
                    "type": "streak",
                    "entity": "checkin",
                    "variant": "mood_improving_7d",
                    "value": 7,
                }
            ),
            "trigger_type": "streak",
            "trigger_entity": "checkin",
            "trigger_value": 7,
            "xp_reward": 40,
            "is_active": True,
        },
    ]
    for b in badges:
        b["tenant_id"] = tenant_id
        b["created_at"] = now
    return badges
