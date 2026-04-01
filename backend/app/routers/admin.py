from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import AuthUser, require_admin
from app.repositories import presets as presets_repo
from app.repositories import users as users_repo
from app.schemas import (
    AdminGlobalPresetCreate,
    AdminGlobalPresetPatch,
    AdminPasswordResetBody,
    AdminUserPatch,
)
from app.security import hash_password
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


@router.post("/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: str, body: AdminPasswordResetBody, admin: AuthUser = Depends(require_admin)
):
    u = users_repo.get_user(admin.tenant_id, user_id)
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    pw_hash = hash_password(body.new_password)
    users_repo.update_user_fields(
        admin.tenant_id,
        user_id,
        {"password_hash": pw_hash, "updated_at": now},
    )
    return {"ok": True}


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


@router.get("/presets/global")
def admin_list_global_presets(admin: AuthUser = Depends(require_admin)):
    items = presets_repo.list_global_presets(admin.tenant_id)
    items.sort(key=lambda x: (x.get("title") or "").lower())
    return {"presets": dynamo_to_json(items), "count": len(items)}


@router.post("/presets/global")
def admin_create_global_preset(body: AdminGlobalPresetCreate, admin: AuthUser = Depends(require_admin)):
    now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    pid = str(uuid.uuid4())
    item = presets_repo.build_preset_item(
        tenant_id=admin.tenant_id,
        preset_id=pid,
        user_id_creator=admin.user_id,
        is_global=True,
        entity_type=body.preset_entity,
        title=body.title.strip(),
        category=body.category.strip(),
        becomehim_stage=body.becomehim_stage,
        duration_seconds=body.duration_seconds if body.duration_seconds is not None else 0,
        youtube_url=body.youtube_url,
        description=body.description,
        created_at_iso=now,
    )
    item["created_by"] = admin.user_id
    presets_repo.put_preset(item)
    return dynamo_to_json(item)


@router.patch("/presets/global/{preset_id}")
def admin_patch_global_preset(
    preset_id: str, body: AdminGlobalPresetPatch, admin: AuthUser = Depends(require_admin)
):
    patch = body.model_dump(exclude_unset=True)
    out = presets_repo.update_global_preset_fields(admin.tenant_id, preset_id, patch)
    if not out:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Global preset not found")
    return dynamo_to_json(out)


@router.delete("/presets/global/{preset_id}")
def admin_delete_global_preset(preset_id: str, admin: AuthUser = Depends(require_admin)):
    if not presets_repo.delete_global_preset(admin.tenant_id, preset_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Global preset not found")
    return {"ok": True}
