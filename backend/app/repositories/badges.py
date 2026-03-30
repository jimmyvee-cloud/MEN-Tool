from __future__ import annotations

import json
from typing import Any

from boto3.dynamodb.conditions import Key

from app.db import get_table
from app.keys import pk_tenant, pk_user, sk_badge_def, sk_user_badge


def put_badge_def(item: dict[str, Any]) -> None:
    get_table().put_item(Item=item)


def list_badge_defs(tenant_id: str) -> list[dict]:
    t = get_table()
    items: list[dict] = []
    kwargs: dict = {
        "KeyConditionExpression": Key("pk").eq(pk_tenant(tenant_id))
        & Key("sk").begins_with("BADGE_DEF#"),
    }
    while True:
        r = t.query(**kwargs)
        items.extend(r.get("Items", []))
        lek = r.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek
    return items


def list_user_badges(tenant_id: str, user_id: str) -> list[dict]:
    t = get_table()
    items: list[dict] = []
    kwargs: dict = {
        "KeyConditionExpression": Key("pk").eq(pk_user(tenant_id, user_id))
        & Key("sk").begins_with("BADGE#"),
    }
    while True:
        r = t.query(**kwargs)
        items.extend(r.get("Items", []))
        lek = r.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek
    return items


def grant_user_badge(
    tenant_id: str, user_id: str, badge_id: str, unlocked_at_iso: str
) -> dict[str, Any] | None:
    if has_user_badge(tenant_id, user_id, badge_id):
        return None
    item = {
        "pk": pk_user(tenant_id, user_id),
        "sk": sk_user_badge(badge_id),
        "entity_type": "USER_BADGE",
        "tenant_id": tenant_id,
        "user_id": user_id,
        "badge_id": badge_id,
        "unlocked_at": unlocked_at_iso,
        "shared": False,
    }
    get_table().put_item(Item=item)
    return item


def has_user_badge(tenant_id: str, user_id: str, badge_id: str) -> bool:
    r = get_table().get_item(Key={"pk": pk_user(tenant_id, user_id), "sk": sk_user_badge(badge_id)})
    return bool(r.get("Item"))


def build_badge_def_item(tenant_id: str, badge: dict[str, Any]) -> dict[str, Any]:
    bid = badge["badge_id"]
    return {
        "pk": pk_tenant(tenant_id),
        "sk": sk_badge_def(bid),
        "entity_type": "BADGE",
        **badge,
    }


def list_badge_catalog(tenant_id: str) -> list[dict[str, Any]]:
    """Public catalog entries for profile UI (all active defs, no secrets)."""
    out: list[dict[str, Any]] = []
    for d in list_badge_defs(tenant_id):
        if not d.get("is_active", True):
            continue
        bid = d.get("badge_id")
        if not bid:
            continue
        parsed_rule: Any = None
        raw = d.get("unlock_rule")
        if isinstance(raw, str) and raw.strip():
            try:
                parsed_rule = json.loads(raw)
            except json.JSONDecodeError:
                parsed_rule = None
        elif isinstance(raw, dict):
            parsed_rule = raw
        out.append(
            {
                "badge_id": bid,
                "title": d.get("title", ""),
                "artwork_url": d.get("artwork_url", ""),
                "unlock_hint": d.get("unlock_hint") or d.get("description", ""),
                "unlock_rule": parsed_rule,
                "catalog_order": int(d.get("catalog_order", 99)),
            }
        )
    out.sort(key=lambda x: (x.get("catalog_order", 99), x.get("badge_id", "")))
    return out
