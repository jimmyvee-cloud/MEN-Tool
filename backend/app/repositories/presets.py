from __future__ import annotations

from typing import Any

from boto3.dynamodb.conditions import Key

from app.db import get_table
from app.keys import pk_tenant, sk_preset_global, sk_preset_user


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
