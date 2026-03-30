from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from boto3.dynamodb.conditions import Key

from app.db import get_table
from app.gamification import XP_MEMBER_PER_DAY, rank_from_xp
from app.keys import (
    gsi1_pk_email,
    gsi2_pk_invite,
    gsi3_pk_tenant_users,
    gsi3_sk_user_created,
    pk_tenant,
    pk_user,
    sk_user_profile,
)


def _iso_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def put_user_item(item: dict[str, Any]) -> None:
    get_table().put_item(Item=item)


def increment_referral_signups(tenant_id: str, user_id: str) -> None:
    """Count invitees who registered with this user's code. No-op if user missing."""
    if not get_user(tenant_id, user_id):
        return
    get_table().update_item(
        Key={"pk": pk_user(tenant_id, user_id), "sk": sk_user_profile()},
        UpdateExpression="ADD referral_signups :one SET updated_at = :u",
        ExpressionAttributeValues={":one": 1, ":u": _iso_now()},
    )


def get_user(tenant_id: str, user_id: str) -> dict | None:
    r = get_table().get_item(Key={"pk": pk_user(tenant_id, user_id), "sk": sk_user_profile()})
    return r.get("Item")


def get_user_by_email(tenant_id: str, email: str) -> dict | None:
    t = get_table()
    r = t.query(
        IndexName="gsi_email",
        KeyConditionExpression=Key("gsi1_pk").eq(gsi1_pk_email(tenant_id, email.lower().strip()))
        & Key("gsi1_sk").begins_with("USER#"),
        Limit=1,
    )
    items = r.get("Items", [])
    return items[0] if items else None


def get_user_by_invite(tenant_id: str, invite_code: str) -> dict | None:
    t = get_table()
    r = t.query(
        IndexName="gsi_invite",
        KeyConditionExpression=Key("gsi2_pk").eq(gsi2_pk_invite(tenant_id, invite_code.strip().upper()))
        & Key("gsi2_sk").begins_with("USER#"),
        Limit=1,
    )
    items = r.get("Items", [])
    return items[0] if items else None


def list_users_tenant(tenant_id: str) -> list[dict]:
    t = get_table()
    items: list[dict] = []
    kwargs: dict = {
        "IndexName": "gsi_tenant_users",
        "KeyConditionExpression": Key("gsi3_pk").eq(gsi3_pk_tenant_users(tenant_id)),
    }
    while True:
        r = t.query(**kwargs)
        items.extend(r.get("Items", []))
        lek = r.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek
    return items


def update_user_fields(tenant_id: str, user_id: str, updates: dict[str, Any]) -> dict | None:
    """Partial update: expression attribute names for reserved words."""
    if not updates:
        return get_user(tenant_id, user_id)
    names: dict[str, str] = {}
    values: dict[str, Any] = {}
    sets = []
    i = 0
    for k, v in updates.items():
        if k in ("pk", "sk"):
            continue
        nk = f"#f{i}"
        vk = f":v{i}"
        names[nk] = k
        values[vk] = v
        sets.append(f"{nk} = {vk}")
        i += 1
    if not sets:
        return get_user(tenant_id, user_id)
    expr = "SET " + ", ".join(sets)
    r = get_table().update_item(
        Key={"pk": pk_user(tenant_id, user_id), "sk": sk_user_profile()},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ReturnValues="ALL_NEW",
    )
    return r.get("Attributes")


def _xp_float(v: Any) -> float:
    if v is None:
        return 0.0
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def increment_xp(tenant_id: str, user_id: str, delta: int | float) -> dict | None:
    u = get_user(tenant_id, user_id)
    if not u:
        return None
    xp = round(_xp_float(u.get("xp_total", 0)) + float(delta), 2)
    ri = rank_from_xp(xp)
    return update_user_fields(
        tenant_id,
        user_id,
        {
            "xp_total": xp,
            "rank_level": ri.rank_level,
            "rank_title": ri.rank_title,
            "updated_at": _iso_now(),
        },
    )


def apply_membership_day_bonus(tenant_id: str, user_id: str) -> None:
    """Award XP_MEMBER_PER_DAY for each full calendar day since created_at not yet credited."""
    u = get_user(tenant_id, user_id)
    if not u:
        return
    created = u.get("created_at")
    if not created or not isinstance(created, str):
        return
    try:
        cdt = datetime.fromisoformat(created.replace("Z", "+00:00"))
    except ValueError:
        return
    now = datetime.now(UTC)
    eligible = max(0, (now - cdt).days)
    prev = int(u.get("membership_days_credited", 0))
    delta_days = eligible - prev
    if delta_days <= 0:
        return
    xp_delta = round(delta_days * XP_MEMBER_PER_DAY, 2)
    increment_xp(tenant_id, user_id, xp_delta)
    update_user_fields(
        tenant_id,
        user_id,
        {"membership_days_credited": eligible, "updated_at": _iso_now()},
    )


def build_user_item(
    *,
    tenant_id: str,
    user_id: str,
    email: str,
    password_hash: str,
    display_name: str,
    invite_code: str,
    invited_by: str | None,
    tier: str = "free",
    avatar_url: str | None = None,
) -> dict[str, Any]:
    now = _iso_now()
    xp = 0.0
    ri = rank_from_xp(xp)
    email_l = email.lower().strip()
    return {
        "pk": pk_user(tenant_id, user_id),
        "sk": sk_user_profile(),
        "entity_type": "USER",
        "tenant_id": tenant_id,
        "user_id": user_id,
        "email": email_l,
        "password_hash": password_hash,
        "display_name": display_name,
        # Default matches PWA static asset `public/mentool-logo.png`
        "avatar_url": (avatar_url or "").strip() or "/mentool-logo.png",
        "tier": tier,
        "invite_code": invite_code.upper(),
        "invited_by": invited_by or "",
        "xp_total": xp,
        "rank_level": ri.rank_level,
        "rank_title": ri.rank_title,
        "is_active": True,
        "refresh_token_hash": "",
        "session_version": 1,
        "created_at": now,
        "updated_at": now,
        "profile_steps_completed": 1,
        "timezone": "",
        "referral_signups": 0,
        "setup_bonus_tz": False,
        "setup_bonus_follow": False,
        "setup_bonus_wall": False,
        "setup_bonus_avatar": False,
        "membership_days_credited": 0,
        "gsi1_pk": gsi1_pk_email(tenant_id, email_l),
        "gsi1_sk": f"USER#{user_id}",
        "gsi2_pk": gsi2_pk_invite(tenant_id, invite_code.upper()),
        "gsi2_sk": f"USER#{user_id}",
        "gsi3_pk": gsi3_pk_tenant_users(tenant_id),
        "gsi3_sk": gsi3_sk_user_created(now, user_id),
    }
