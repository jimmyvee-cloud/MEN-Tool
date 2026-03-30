from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings
from app.repositories import tenants as tenants_repo
from app.repositories import users as users_repo
from app.security import decode_access_token, verify_api_key_plain

security_bearer = HTTPBearer(auto_error=False)


@dataclass
class TenantCtx:
    tenant_id: str
    tenant: dict


@dataclass
class AuthUser:
    tenant_id: str
    user_id: str
    tier: str
    email: str
    display_name: str


async def get_tenant_ctx(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
) -> TenantCtx:
    if not x_api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing X-API-Key")
    s = get_settings()
    tid = (x_tenant_id or s.default_tenant_id).strip()
    tenant = tenants_repo.get_tenant(tid)
    if not tenant or not tenant.get("is_active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Unknown or inactive tenant")
    stored = tenant.get("api_key_hash", "")
    if not verify_api_key_plain(x_api_key, stored):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API key")
    return TenantCtx(tenant_id=tid, tenant=tenant)


async def get_current_user(
    tenant: TenantCtx = Depends(get_tenant_ctx),
    creds: HTTPAuthorizationCredentials | None = Depends(security_bearer),
) -> AuthUser:
    if not creds or not creds.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    try:
        payload = decode_access_token(creds.credentials)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")
    uid = payload.get("sub")
    tid = payload.get("tenant_id")
    if not uid or tid != tenant.tenant_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Tenant mismatch")
    u = users_repo.get_user(tid, uid)
    if not u or not u.get("is_active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "User inactive or missing")
    if int(u.get("session_version", 1)) != int(payload.get("sv", 1)):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session revoked")
    return AuthUser(
        tenant_id=tid,
        user_id=uid,
        tier=u.get("tier", "free"),
        email=u.get("email", ""),
        display_name=u.get("display_name", ""),
    )


async def require_admin(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if user.tier != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return user
