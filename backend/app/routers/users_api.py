from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.badge_engine import evaluate_badges_after_action
from app.deps import AuthUser, get_current_user
from app.gamification import XP_FIRST_FOLLOW, XP_WALL_OTHER, XP_WALL_SELF, rank_from_xp
from app.repositories import badges as badges_repo
from app.repositories import logs as logs_repo
from app.repositories import social as social_repo
from app.repositories import users as users_repo
from app.schemas import WallPostCreate
from app.util import dynamo_to_json

router = APIRouter(prefix="/users", tags=["users"])


def _iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _public_user_bundle(tenant_id: str, uid: str, viewer: AuthUser | None):
    u = users_repo.get_user(tenant_id, uid)
    if not u or not u.get("is_active", True):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if viewer and social_repo.is_blocked(tenant_id, uid, viewer.user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Blocked")
    if viewer and social_repo.is_blocked(tenant_id, viewer.user_id, uid):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Blocked")

    def nactive(xs):
        return len([x for x in xs if not x.get("is_deleted")])

    checkins = logs_repo.list_checkins(tenant_id, uid)
    stressors = logs_repo.list_stressors(tenant_id, uid)
    reliefs = logs_repo.list_reliefs(tenant_id, uid)
    ri = rank_from_xp(u.get("xp_total", 0))
    ub = badges_repo.list_user_badges(tenant_id, uid)
    bcat = badges_repo.list_badge_catalog(tenant_id)
    following = social_repo.is_following(tenant_id, viewer.user_id, uid) if viewer else False
    return {
        "user": {
            "user_id": u.get("user_id"),
            "display_name": u.get("display_name"),
            "avatar_url": u.get("avatar_url"),
            "tier": u.get("tier"),
            "created_at": u.get("created_at"),
            "invite_code": u.get("invite_code") if viewer and viewer.user_id == uid else None,
        },
        "stats": {
            "checkins": nactive(checkins),
            "stressors": nactive(stressors),
            "reliefs": nactive(reliefs),
        },
        "rank": {
            "rank_level": ri.rank_level,
            "rank_title": ri.rank_title,
            "xp_total": ri.xp_total,
            "next_rank_title": ri.next_rank_title,
            "progress_pct": ri.progress_pct,
        },
        "badges": dynamo_to_json(ub),
        "badge_catalog": dynamo_to_json(bcat),
        "social": {"is_following": following},
    }


@router.get("/search")
def search_users(
    q: str = "",
    limit: int = 25,
    user: AuthUser = Depends(get_current_user),
):
    """Find tenant members by display name (case-insensitive substring)."""
    needle = q.strip().lower()
    if len(needle) < 1:
        return []
    limit = max(1, min(int(limit), 50))
    items = users_repo.list_users_tenant(user.tenant_id)
    matches: list[dict] = []
    for u in items:
        if u.get("sk") != "PROFILE":
            continue
        if not u.get("is_active", True):
            continue
        uid = u.get("user_id")
        if not uid or uid == user.user_id:
            continue
        if social_repo.is_blocked(user.tenant_id, user.user_id, uid):
            continue
        if social_repo.is_blocked(user.tenant_id, uid, user.user_id):
            continue
        name = (u.get("display_name") or "").strip()
        if needle not in name.lower():
            continue
        matches.append(
            {
                "user_id": uid,
                "display_name": name,
                "avatar_url": u.get("avatar_url", ""),
            }
        )
    matches.sort(key=lambda x: (x.get("display_name") or "").lower())
    return dynamo_to_json(matches[:limit])


@router.get("/{user_id}")
def get_public_profile(user_id: str, viewer: AuthUser = Depends(get_current_user)):
    return _public_user_bundle(viewer.tenant_id, user_id, viewer)


@router.post("/{user_id}/follow")
def follow(user_id: str, user: AuthUser = Depends(get_current_user)):
    if social_repo.is_blocked(user.tenant_id, user_id, user.user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot follow")
    pre = len(social_repo.list_following(user.tenant_id, user.user_id))
    social_repo.add_follow(user.tenant_id, user.user_id, user_id)
    u = users_repo.get_user(user.tenant_id, user.user_id)
    badges_unlocked: list = []
    if u and pre == 0 and not u.get("setup_bonus_follow"):
        users_repo.update_user_fields(
            user.tenant_id,
            user.user_id,
            {"setup_bonus_follow": True, "updated_at": _iso()},
        )
        users_repo.increment_xp(user.tenant_id, user.user_id, XP_FIRST_FOLLOW)
        badges_unlocked = evaluate_badges_after_action(user.tenant_id, user.user_id, "checkin")
    return {"ok": True, "badges_unlocked": dynamo_to_json(badges_unlocked)}


@router.delete("/{user_id}/follow")
def unfollow(user_id: str, user: AuthUser = Depends(get_current_user)):
    social_repo.remove_follow(user.tenant_id, user.user_id, user_id)
    return {"ok": True}


@router.post("/{user_id}/block")
def block(user_id: str, user: AuthUser = Depends(get_current_user)):
    social_repo.add_block(user.tenant_id, user.user_id, user_id)
    return {"ok": True}


@router.get("/{user_id}/wall")
def wall(user_id: str, user: AuthUser = Depends(get_current_user)):
    if social_repo.is_blocked(user.tenant_id, user_id, user.user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Blocked")
    posts = social_repo.list_wall_posts(user.tenant_id, user_id)
    return dynamo_to_json(posts)


@router.post("/{user_id}/wall")
def post_wall(user_id: str, body: WallPostCreate, user: AuthUser = Depends(get_current_user)):
    if social_repo.is_blocked(user.tenant_id, user_id, user.user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Blocked")
    pid = str(uuid.uuid4())
    created = _iso()
    item = social_repo.add_wall_post(
        user.tenant_id,
        user_id,
        pid,
        user.user_id,
        body.content.strip(),
        created,
    )
    badges_unlocked: list = []
    if user_id == user.user_id:
        users_repo.increment_xp(user.tenant_id, user.user_id, XP_WALL_SELF)
    else:
        users_repo.increment_xp(user.tenant_id, user.user_id, XP_WALL_OTHER)
    badges_unlocked = evaluate_badges_after_action(user.tenant_id, user.user_id, "checkin")
    body = dynamo_to_json(item)
    if isinstance(body, dict):
        body["badges_unlocked"] = dynamo_to_json(badges_unlocked)
    return body
