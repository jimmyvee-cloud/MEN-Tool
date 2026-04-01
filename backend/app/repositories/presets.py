from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from boto3.dynamodb.conditions import Key

from app.db import get_table
from app.keys import pk_tenant, sk_preset_global, sk_preset_user


def _iso_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def put_preset(item: dict[str, Any]) -> None:
    get_table().put_item(Item=item)


def list_presets_for_tenant(tenant_id: str, user_id: str) -> list[dict]:
    """Global presets + current user's personal presets."""
    t = get_table()
    r = t.query(
        KeyConditionExpression=Key("pk").eq(pk_tenant(tenant_id))
        & Key("sk").begins_with("PRESET#"),
    )
    items = r.get("Items", [])
    out: list[dict] = []
    for it in items:
        sk = it.get("sk", "")
        if sk.startswith("PRESET#GLOBAL#"):
            out.append(it)
        elif sk.startswith(f"PRESET#USER#{user_id}#"):
            out.append(it)
    return out


def list_global_presets(tenant_id: str) -> list[dict]:
    t = get_table()
    items: list[dict] = []
    kwargs: dict = {
        "KeyConditionExpression": Key("pk").eq(pk_tenant(tenant_id))
        & Key("sk").begins_with("PRESET#GLOBAL#"),
    }
    while True:
        r = t.query(**kwargs)
        items.extend(r.get("Items", []))
        lek = r.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek
    return items


def get_global_preset(tenant_id: str, preset_id: str) -> dict | None:
    r = get_table().get_item(Key={"pk": pk_tenant(tenant_id), "sk": sk_preset_global(preset_id)})
    return r.get("Item")


def delete_global_preset(tenant_id: str, preset_id: str) -> bool:
    p = get_global_preset(tenant_id, preset_id)
    if not p:
        return False
    get_table().delete_item(Key={"pk": pk_tenant(tenant_id), "sk": sk_preset_global(preset_id)})
    return True


def update_global_preset_fields(tenant_id: str, preset_id: str, updates: dict[str, Any]) -> dict | None:
    p = get_global_preset(tenant_id, preset_id)
    if not p:
        return None
    for k, v in updates.items():
        if v is None:
            continue
        if k == "duration_seconds":
            p["duration_seconds"] = int(v)
        elif k == "youtube_url":
            p["youtube_url"] = (v or "").strip()
        elif k == "title":
            p["title"] = str(v).strip()
        elif k == "category":
            p["category"] = str(v).strip()
        elif k == "description":
            p["description"] = (v or "").strip() if v is not None else ""
        elif k == "preset_entity":
            p["preset_entity"] = str(v).strip()
        elif k == "becomehim_stage":
            p["becomehim_stage"] = (v or "").strip() if v is not None else ""
    p["updated_at"] = _iso_now()
    put_preset(p)
    return p


def get_preset_by_id(tenant_id: str, preset_id: str, user_id: str | None) -> dict | None:
    # try global
    r = get_table().get_item(Key={"pk": pk_tenant(tenant_id), "sk": sk_preset_global(preset_id)})
    if r.get("Item"):
        return r["Item"]
    if user_id:
        r2 = get_table().get_item(
            Key={"pk": pk_tenant(tenant_id), "sk": sk_preset_user(user_id, preset_id)}
        )
        if r2.get("Item"):
            return r2["Item"]
    return None


def build_preset_item(
    *,
    tenant_id: str,
    preset_id: str,
    user_id_creator: str,
    is_global: bool,
    entity_type: str,
    title: str,
    category: str,
    becomehim_stage: str | None = None,
    duration_seconds: int | None = None,
    youtube_url: str | None = None,
    description: str | None = None,
    version: int = 1,
    created_at_iso: str,
) -> dict[str, Any]:
    sk = sk_preset_global(preset_id) if is_global else sk_preset_user(user_id_creator, preset_id)
    return {
        "pk": pk_tenant(tenant_id),
        "sk": sk,
        "entity_type": "PRESET",
        "preset_id": preset_id,
        "tenant_id": tenant_id,
        "created_by": user_id_creator,
        "is_global": is_global,
        "preset_entity": entity_type,
        "title": title,
        "category": category,
        "becomehim_stage": becomehim_stage or "",
        "duration_seconds": duration_seconds if duration_seconds is not None else 0,
        "youtube_url": youtube_url or "",
        "description": description or "",
        "version": version,
        "created_at": created_at_iso,
    }
