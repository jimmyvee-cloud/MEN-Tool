from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.config import Settings, get_settings


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), password_hash.encode())
    except ValueError:
        return False


def create_access_token(
    *,
    user_id: str,
    tenant_id: str,
    tier: str,
    session_version: int = 1,
    settings: Settings | None = None,
) -> str:
    s = settings or get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "tier": tier,
        "sv": session_version,
        "iat": now,
        "exp": now + timedelta(minutes=s.access_token_expire_minutes),
        "type": "access",
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def create_refresh_token(
    *,
    user_id: str,
    tenant_id: str,
    tier: str,
    session_version: int,
    settings: Settings | None = None,
) -> str:
    s = settings or get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "tier": tier,
        "sv": session_version,
        "iat": now,
        "exp": now + timedelta(days=s.refresh_token_expire_days),
        "type": "refresh",
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_access_token(token: str, settings: Settings | None = None) -> dict:
    s = settings or get_settings()
    return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])


def decode_refresh_token(token: str, settings: Settings | None = None) -> dict:
    s = settings or get_settings()
    return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])


def verify_api_key_plain(plain_key: str, stored_hash: str) -> bool:
    return verify_password(plain_key, stored_hash)
