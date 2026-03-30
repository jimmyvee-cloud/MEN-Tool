from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import AuthUser, require_admin
from app.repositories import users as users_repo
from app.schemas import AdminUserPatch
from app.util import dynamo_to_json

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
def admin_users(admin: AuthUser = Depends(require_admin)):
    items = users_repo.list_users_tenant(admin.tenant_id)
    out = []
    for u in items:
        if u.get("sk") != "PROFILE":
            continue
        out.append(
            {
                "user_id": u.get("user_id"),
                "email": u.get("email"),
                "display_name": u.get("display_name"),
                "tier": u.get("tier"),
                "created_at": u.get("created_at"),
                "invite_code": u.get("invite_code"),
                "invited_by": u.get("invited_by"),
                "is_active": u.get("is_active"),
            }
        )
    return {"users": dynamo_to_json(out), "count": len(out)}


@router.get("/referrals")
def referrals(admin: AuthUser = Depends(require_admin)):
    full = [
        u
        for u in users_repo.list_users_tenant(admin.tenant_id)
        if u.get("sk") == "PROFILE"
    ]
    edges = []
    for u in full:
        inv = u.get("invited_by") or ""
        if inv:
            edges.append(
                {
                    "referred_user_id": u.get("user_id"),
                    "referrer_user_id": inv,
                    "email": u.get("email"),
                }
            )
    return {"referrals": edges}


@router.patch("/users/{user_id}")
def patch_admin_user(
    user_id: str, body: AdminUserPatch, admin: AuthUser = Depends(require_admin)
):
    u = users_repo.get_user(admin.tenant_id, user_id)
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    updates: dict = {"updated_at": now}
    if body.tier is not None:
        updates["tier"] = body.tier
    if body.is_active is not None:
        if not body.is_active and user_id == admin.user_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Cannot deactivate your own account",
            )
        updates["is_active"] = body.is_active
    nu = users_repo.update_user_fields(admin.tenant_id, user_id, updates)
    return dynamo_to_json(
        {k: v for k, v in (nu or {}).items() if k not in ("password_hash", "refresh_token_hash")}
    )
