from __future__ import annotations

from typing import Any

from boto3.dynamodb.conditions import Key

from app.db import get_table
from app.keys import pk_user, sk_checkin, sk_relief, sk_stressor


def put_log(item: dict[str, Any]) -> None:
    get_table().put_item(Item=item)


def _query_prefix(tenant_id: str, user_id: str, prefix: str) -> list[dict]:
    t = get_table()
    items: list[dict] = []
    kwargs: dict = {
        "KeyConditionExpression": Key("pk").eq(pk_user(tenant_id, user_id))
        & Key("sk").begins_with(prefix),
    }
    while True:
        r = t.query(**kwargs)
        items.extend(r.get("Items", []))
        lek = r.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek
    return items


def list_checkins(tenant_id: str, user_id: str) -> list[dict]:
    return sorted(
        _query_prefix(tenant_id, user_id, "CHECKIN#"),
        key=lambda x: x.get("sk", ""),
    )


def list_stressors(tenant_id: str, user_id: str) -> list[dict]:
    return sorted(
        _query_prefix(tenant_id, user_id, "STRESSOR#"),
        key=lambda x: x.get("sk", ""),
    )


def list_reliefs(tenant_id: str, user_id: str) -> list[dict]:
    return sorted(
        _query_prefix(tenant_id, user_id, "RELIEF#"),
        key=lambda x: x.get("sk", ""),
    )


def get_log_item(tenant_id: str, user_id: str, sk: str) -> dict | None:
    r = get_table().get_item(Key={"pk": pk_user(tenant_id, user_id), "sk": sk})
    return r.get("Item")


def soft_delete_log(tenant_id: str, user_id: str, sk: str) -> None:
    get_table().update_item(
        Key={"pk": pk_user(tenant_id, user_id), "sk": sk},
        UpdateExpression="SET is_deleted = :t",
        ExpressionAttributeValues={":t": True},
    )


def build_stressor_item(
    *,
    tenant_id: str,
    user_id: str,
    stressor_id: str,
    logged_at_iso: str,
    title: str,
    category: str,
    intensity: int,
    preset_id: str | None,
    notes: str | None,
    created_at_iso: str,
    is_deleted: bool = False,
) -> dict[str, Any]:
    return {
        "pk": pk_user(tenant_id, user_id),
        "sk": sk_stressor(logged_at_iso, stressor_id),
        "entity_type": "STRESSOR",
        "tenant_id": tenant_id,
        "user_id": user_id,
        "stressor_id": stressor_id,
        "title": title,
        "category": category,
        "intensity": intensity,
        "preset_id": preset_id or "",
        "notes": notes or "",
        "logged_at": logged_at_iso,
        "created_at": created_at_iso,
        "is_deleted": is_deleted,
    }


def build_relief_item(
    *,
    tenant_id: str,
    user_id: str,
    relief_id: str,
    logged_at_iso: str,
    title: str,
    category: str,
    duration_seconds: int,
    effectiveness: int,
    focus: int,
    preset_id: str | None,
    youtube_url: str | None,
    notes: str | None,
    created_at_iso: str,
    is_deleted: bool = False,
) -> dict[str, Any]:
    return {
        "pk": pk_user(tenant_id, user_id),
        "sk": sk_relief(logged_at_iso, relief_id),
        "entity_type": "RELIEF",
        "tenant_id": tenant_id,
        "user_id": user_id,
        "relief_id": relief_id,
        "title": title,
        "category": category,
        "duration_seconds": duration_seconds,
        "effectiveness": effectiveness,
        "focus": focus,
        "preset_id": preset_id or "",
        "youtube_url": youtube_url or "",
        "notes": notes or "",
        "logged_at": logged_at_iso,
        "created_at": created_at_iso,
        "is_deleted": is_deleted,
    }


def build_checkin_item(
    *,
    tenant_id: str,
    user_id: str,
    checkin_id: str,
    logged_at_iso: str,
    mood_score: int,
    note: str | None,
    created_at_iso: str,
    is_deleted: bool = False,
) -> dict[str, Any]:
    return {
        "pk": pk_user(tenant_id, user_id),
        "sk": sk_checkin(logged_at_iso, checkin_id),
        "entity_type": "CHECKIN",
        "tenant_id": tenant_id,
        "user_id": user_id,
        "checkin_id": checkin_id,
        "mood_score": mood_score,
        "note": note or "",
        "logged_at": logged_at_iso,
        "created_at": created_at_iso,
        "is_deleted": is_deleted,
    }
