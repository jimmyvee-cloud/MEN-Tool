"""Seed default tenant, API key hash, badges, sample global presets, admin user."""

from __future__ import annotations

import os
import sys
import uuid
from datetime import UTC, datetime

import bcrypt
import boto3

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND = os.path.join(ROOT, "backend")
if os.path.isdir(BACKEND):
    sys.path.insert(0, BACKEND)
if os.path.isdir("/app"):
    sys.path.insert(0, "/app")

TABLE_NAME = os.environ.get("DYNAMODB_TABLE_NAME", "men-tool-dev")
REGION = os.environ.get("AWS_REGION", "us-east-1")
ENDPOINT = os.environ.get("DYNAMODB_ENDPOINT_URL")
TENANT_ID = os.environ.get("DEFAULT_TENANT_ID", "mentool")
API_KEY = os.environ.get("MENTOOL_DEV_API_KEY", "dev-tenant-api-key-change-me")


def _table():
    kw: dict = {"region_name": REGION}
    if ENDPOINT:
        kw["endpoint_url"] = ENDPOINT
    if os.environ.get("AWS_ACCESS_KEY_ID"):
        kw["aws_access_key_id"] = os.environ["AWS_ACCESS_KEY_ID"]
        kw["aws_secret_access_key"] = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
    return boto3.resource("dynamodb", **kw).Table(TABLE_NAME)


def _iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def promote_admin_emails() -> None:
    """Set tier=admin (and ensure active) for listed emails if a profile already exists.

    Comma-separated list in SEED_PROMOTE_ADMIN_EMAILS only — no built-in default (safe for production).
    Each email must already have a user row (register in-app or Google first). Missing users are skipped quietly.
    """
    from boto3.dynamodb.conditions import Key

    from app.keys import gsi1_pk_email, pk_user, sk_user_profile

    raw = (os.environ.get("SEED_PROMOTE_ADMIN_EMAILS") or "").strip()
    if not raw:
        return
    emails = [e.strip().lower() for e in raw.split(",") if e.strip()]
    if not emails:
        return
    t = _table()
    now = _iso()
    for email in emails:
        r = t.query(
            IndexName="gsi_email",
            KeyConditionExpression=Key("gsi1_pk").eq(gsi1_pk_email(TENANT_ID, email))
            & Key("gsi1_sk").begins_with("USER#"),
            Limit=1,
        )
        items = r.get("Items", [])
        if not items:
            print(f"promote_admin: skip (no user yet): {email}")
            continue
        u = items[0]
        uid = u.get("user_id")
        if not uid:
            continue
        t.update_item(
            Key={"pk": pk_user(TENANT_ID, uid), "sk": sk_user_profile()},
            UpdateExpression="SET tier = :a, is_active = :act, updated_at = :u",
            ExpressionAttributeValues={":a": "admin", ":act": True, ":u": now},
        )
        print(f"promote_admin: tier=admin for {email} (user_id={uid})")


def main():
    t = _table()
    now = _iso()
    api_hash = bcrypt.hashpw(API_KEY.encode(), bcrypt.gensalt()).decode()

    t.put_item(
        Item={
            "pk": f"TENANT#{TENANT_ID}",
            "sk": "META",
            "entity_type": "TENANT",
            "tenant_id": TENANT_ID,
            "name": "MEN-Tool",
            "api_key_hash": api_hash,
            "is_active": True,
            "plan": "owner",
            "created_at": now,
        }
    )
    print(f"Seeded tenant {TENANT_ID}. API key (plaintext): {API_KEY}")

    # Gamification badge defs
    from app.gamification import default_badge_defs
    from app.repositories.badges import build_badge_def_item

    for b in default_badge_defs(TENANT_ID):
        item = build_badge_def_item(TENANT_ID, b)
        t.put_item(Item=item)

    # Global relief presets
    from app.repositories.presets import build_preset_item

    presets_spec = [
        (
            "preset_mindvalley",
            "Mindvalley 6 Phase",
            "meditation",
            1200,
            "",  # Set youtube_url to a watch or youtu.be URL; UI builds /embed/{id} from it.
        ),
        ("preset_wimhof", "Wim Hof Breathing", "breathwork", 600, None),
        ("preset_walk", "Brisk Walk", "physical", 900, None),
    ]
    for pid, title, cat, dur, yt in presets_spec:
        p = build_preset_item(
            tenant_id=TENANT_ID,
            preset_id=pid,
            user_id_creator="system",
            is_global=True,
            entity_type="relief",
            title=title,
            category=cat,
            duration_seconds=dur,
            youtube_url=yt or "",
            description="",
            created_at_iso=now,
        )
        p["created_by"] = "system"
        t.put_item(Item=p)

    # Admin user
    from app.keys import gsi1_pk_email, gsi2_pk_invite, gsi3_pk_tenant_users, gsi3_sk_user_created, pk_user
    from app.repositories.users import sk_user_profile
    from app.security import hash_password
    from app.gamification import rank_from_xp

    admin_email = "admin@mentool.local".lower()
    admin_pass = os.environ.get("SEED_ADMIN_PASSWORD", "Admin12345!")
    uid = str(uuid.uuid4())
    invite = "ADMIN01"
    xp = 0
    ri = rank_from_xp(xp)
    u = {
        "pk": pk_user(TENANT_ID, uid),
        "sk": sk_user_profile(),
        "entity_type": "USER",
        "tenant_id": TENANT_ID,
        "user_id": uid,
        "email": admin_email,
        "password_hash": hash_password(admin_pass),
        "display_name": "Admin",
        "avatar_url": "/mentool-logo.png",
        "tier": "admin",
        "invite_code": invite,
        "invited_by": "",
        "xp_total": xp,
        "rank_level": ri.rank_level,
        "rank_title": ri.rank_title,
        "is_active": True,
        "refresh_token_hash": "",
        "session_version": 1,
        "created_at": now,
        "updated_at": now,
        "profile_steps_completed": 5,
        "referral_bonus_paid": False,
        "setup_bonus_tz": False,
        "setup_bonus_follow": False,
        "setup_bonus_wall": False,
        "setup_bonus_avatar": False,
        "setup_dismissed": False,
        "membership_days_credited": 0,
        "gsi1_pk": gsi1_pk_email(TENANT_ID, admin_email),
        "gsi1_sk": f"USER#{uid}",
        "gsi2_pk": gsi2_pk_invite(TENANT_ID, invite),
        "gsi2_sk": f"USER#{uid}",
        "gsi3_pk": gsi3_pk_tenant_users(TENANT_ID),
        "gsi3_sk": gsi3_sk_user_created(now, uid),
    }
    t.put_item(Item=u)
    print(f"Seeded admin {admin_email} / {admin_pass} user_id={uid} invite={invite}")

    promote_admin_emails()


if __name__ == "__main__":
    if "--promote-only" in sys.argv:
        promote_admin_emails()
    else:
        main()
