from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.deps import AuthUser, TenantCtx, get_current_user, get_tenant_ctx
from app.gamification import XP_REFERRAL
from app.repositories import users as users_repo
from app.schemas import LoginBody, RefreshBody, RegisterBody, TokenResponse
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _gen_invite() -> str:
    return secrets.token_hex(4).upper()


def _issue_tokens(tenant_id: str, user_id: str, tier: str, session_version: int):
    s = get_settings()
    access = create_access_token(
        user_id=user_id,
        tenant_id=tenant_id,
        tier=tier,
        session_version=session_version,
    )
    refresh = create_refresh_token(
        user_id=user_id,
        tenant_id=tenant_id,
        tier=tier,
        session_version=session_version,
    )
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=s.access_token_expire_minutes * 60,
    )


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterBody, tenant: TenantCtx = Depends(get_tenant_ctx)):
    email = body.email.lower().strip()
    if users_repo.get_user_by_email(tenant.tenant_id, email):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")
    invited_by: str | None = None
    if body.invite_code:
        ref = users_repo.get_user_by_invite(tenant.tenant_id, body.invite_code)
        if ref:
            invited_by = ref.get("user_id")
    user_id = str(uuid.uuid4())
    invite = _gen_invite()
    while users_repo.get_user_by_invite(tenant.tenant_id, invite):
        invite = _gen_invite()
    pw_hash = hash_password(body.password)
    item = users_repo.build_user_item(
        tenant_id=tenant.tenant_id,
        user_id=user_id,
        email=email,
        password_hash=pw_hash,
        display_name=body.display_name.strip(),
        invite_code=invite,
        invited_by=invited_by,
    )
    item["referral_bonus_paid"] = False
    item["session_version"] = 1
    users_repo.put_user_item(item)
    if invited_by:
        users_repo.increment_referral_signups(tenant.tenant_id, invited_by)
        if users_repo.get_user(tenant.tenant_id, invited_by):
            users_repo.increment_xp(tenant.tenant_id, invited_by, XP_REFERRAL)
    u = users_repo.get_user(tenant.tenant_id, user_id)
    return _issue_tokens(
        tenant.tenant_id,
        user_id,
        u.get("tier", "free"),
        int(u.get("session_version", 1)),
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginBody, tenant: TenantCtx = Depends(get_tenant_ctx)):
    email = body.email.lower().strip()
    u = users_repo.get_user_by_email(tenant.tenant_id, email)
    if not u or not verify_password(body.password, u.get("password_hash", "")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not u.get("is_active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")
    uid = u["user_id"]
    users_repo.apply_membership_day_bonus(tenant.tenant_id, uid)
    users_repo.update_user_fields(tenant.tenant_id, uid, {"updated_at": _iso()})
    return _issue_tokens(
        tenant.tenant_id,
        uid,
        u.get("tier", "free"),
        int(u.get("session_version", 1)),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_session(body: RefreshBody, tenant: TenantCtx = Depends(get_tenant_ctx)):
    try:
        payload = decode_refresh_token(body.refresh_token)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")
    uid = payload.get("sub")
    tid = payload.get("tenant_id")
    if not uid or tid != tenant.tenant_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid tenant")
    u = users_repo.get_user(tid, uid)
    if not u or not u.get("is_active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "User inactive")
    if int(u.get("session_version", 1)) != int(payload.get("sv", 1)):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session revoked")
    return _issue_tokens(
        tid,
        uid,
        u.get("tier", "free"),
        int(u.get("session_version", 1)),
    )


@router.post("/logout")
def logout(user: AuthUser = Depends(get_current_user)):
    uid = user.user_id
    tid = user.tenant_id
    u = users_repo.get_user(tid, uid)
    if not u:
        return {"ok": True}
    sv = int(u.get("session_version", 1)) + 1
    users_repo.update_user_fields(tid, uid, {"session_version": sv, "updated_at": _iso()})
    return {"ok": True}
