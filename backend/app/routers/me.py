from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends

from app import gamification
from app.badge_engine import evaluate_badges_after_action
from app.deps import AuthUser, get_current_user
from app.gamification import XP_AVATAR_UPLOAD, XP_TIMEZONE
from app.repositories import badges as badges_repo
from app.repositories import logs as logs_repo
from app.repositories import social as social_repo
from app.repositories import users as users_repo
from app.schemas import ProfilePatch
from app.util import dynamo_to_json

router = APIRouter(prefix="/me", tags=["me"])


def _iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _default_avatar(url: str | None) -> bool:
    u = (url or "").strip()
    return u == "" or u == "/mentool-logo.png"


def _setup_progress(tenant_id: str, uid: str, u: dict) -> dict:
    tz_done = bool((u.get("timezone") or "").strip())
    follow_done = len(social_repo.list_following(tenant_id, uid)) >= 1
    ref_done = int(u.get("referral_signups", 0) or 0) > 0
    wall_posts = social_repo.list_wall_posts(tenant_id, uid)
    wall_done = any(str(p.get("author_user_id")) == str(uid) for p in wall_posts)
    photo_done = bool(u.get("setup_bonus_avatar")) or not _default_avatar(u.get("avatar_url"))
    tasks_meta = [
        ("timezone", "Set your timezone", XP_TIMEZONE, tz_done),
        ("photo", "Add a profile photo", XP_AVATAR_UPLOAD, photo_done),
        ("follow", "Follow a friend", 10, follow_done),
        ("refer", "Refer a friend", 50, ref_done),
        ("wall", "Write on your wall", 1, wall_done),
    ]
    tasks = [
        {"id": tid, "label": lab, "points": pts, "done": done}
        for tid, lab, pts, done in tasks_meta
    ]
    done_n = sum(1 for t in tasks if t["done"])
    return {"tasks": tasks, "completed": done_n, "total": len(tasks)}


@router.get("")
def me(user: AuthUser = Depends(get_current_user)):
    users_repo.apply_membership_day_bonus(user.tenant_id, user.user_id)
    u = users_repo.get_user(user.tenant_id, user.user_id)
    if not u:
        return {}
    ri = gamification.rank_from_xp(u.get("xp_total", 0))
    ub = badges_repo.list_user_badges(user.tenant_id, user.user_id)
    bcat = badges_repo.list_badge_catalog(user.tenant_id)
    setup = _setup_progress(user.tenant_id, user.user_id, u)
    return dynamo_to_json(
        {
            "user": {k: v for k, v in u.items() if k not in ("password_hash", "refresh_token_hash")},
            "rank": {
                "rank_level": ri.rank_level,
                "rank_title": ri.rank_title,
                "xp_total": ri.xp_total,
                "next_rank_title": ri.next_rank_title,
                "progress_pct": ri.progress_pct,
            },
            "badges": ub,
            "badge_catalog": bcat,
            "setup": setup,
        }
    )


@router.patch("")
def patch_me(body: ProfilePatch, user: AuthUser = Depends(get_current_user)):
    tid, uid = user.tenant_id, user.user_id
    u = users_repo.get_user(tid, uid)
    if not u:
        return {}
    updates: dict = {"updated_at": _iso()}
    if body.display_name is not None:
        updates["display_name"] = body.display_name.strip()
    avatar_xp = False
    if body.avatar_url is not None:
        new_av = body.avatar_url.strip()
        updates["avatar_url"] = new_av
        prev_av = (u.get("avatar_url") or "").strip()
        if (
            new_av
            and not _default_avatar(new_av)
            and _default_avatar(prev_av)
            and not u.get("setup_bonus_avatar")
        ):
            updates["setup_bonus_avatar"] = True
            avatar_xp = True
    tz_xp = False
    if body.timezone is not None:
        tz_new = body.timezone.strip()
        prev_tz = (u.get("timezone") or "").strip()
        updates["timezone"] = tz_new
        if tz_new and not prev_tz and not u.get("setup_bonus_tz"):
            updates["setup_bonus_tz"] = True
            tz_xp = True
    if body.profile_steps_completed is not None:
        updates["profile_steps_completed"] = body.profile_steps_completed
    nu = users_repo.update_user_fields(tid, uid, updates)
    if not nu:
        return {}
    if tz_xp:
        users_repo.increment_xp(tid, uid, XP_TIMEZONE)
        evaluate_badges_after_action(tid, uid, "checkin")
    if avatar_xp:
        users_repo.increment_xp(tid, uid, XP_AVATAR_UPLOAD)
        evaluate_badges_after_action(tid, uid, "checkin")
    nu = users_repo.get_user(tid, uid)
    return dynamo_to_json({k: v for k, v in nu.items() if k not in ("password_hash", "refresh_token_hash")})


@router.get("/counts")
def counts(user: AuthUser = Depends(get_current_user)):
    tid, uid = user.tenant_id, user.user_id

    def nactive(xs):
        return len([x for x in xs if not x.get("is_deleted")])

    return {
        "checkins": nactive(logs_repo.list_checkins(tid, uid)),
        "stressors": nactive(logs_repo.list_stressors(tid, uid)),
        "reliefs": nactive(logs_repo.list_reliefs(tid, uid)),
    }


def _is_premium_tier(tier: str | None) -> bool:
    return (tier or "").lower() == "premium"


@router.get("/referrals")
def my_referrals(user: AuthUser = Depends(get_current_user)):
    """Users who registered with the current user's invite code."""
    tid, uid = user.tenant_id, user.user_id
    items = users_repo.list_users_tenant(tid)
    refs: list[dict] = []
    for u in items:
        if u.get("sk") != "PROFILE":
            continue
        if not u.get("is_active", True):
            continue
        if str(u.get("invited_by") or "") != str(uid):
            continue
        refs.append(
            {
                "user_id": u.get("user_id"),
                "display_name": (u.get("display_name") or "").strip() or "Member",
                "created_at": u.get("created_at"),
                "tier": u.get("tier") or "free",
            }
        )
    refs.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    converted = sum(1 for r in refs if _is_premium_tier(r.get("tier")))
    return dynamo_to_json(
        {
            "referrals": refs,
            "stats": {
                "referrals": len(refs),
                "converted": converted,
                "commission_pct": 33,
            },
        }
    )


@router.get("/following")
def my_following(user: AuthUser = Depends(get_current_user)):
    """Profiles the current user follows (private). Newest follow first."""
    tid, uid = user.tenant_id, user.user_id
    edges = social_repo.list_following(tid, uid)
    edges = sorted(edges, key=lambda e: e.get("created_at", ""), reverse=True)
    out: list[dict] = []
    seen: set[str] = set()
    for e in edges:
        fid = e.get("followed_user_id")
        if not fid or fid in seen:
            continue
        seen.add(fid)
        if social_repo.is_blocked(tid, uid, fid) or social_repo.is_blocked(tid, fid, uid):
            continue
        pu = users_repo.get_user(tid, fid)
        if not pu or not pu.get("is_active", True):
            continue
        out.append(
            {
                "user_id": fid,
                "display_name": pu.get("display_name", ""),
                "avatar_url": pu.get("avatar_url", ""),
            }
        )
    return dynamo_to_json(out)
