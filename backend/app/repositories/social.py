from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from boto3.dynamodb.conditions import Key

from app.db import get_table
from app.keys import gsi4_pk_followers, pk_user, sk_block, sk_follower, sk_following, sk_wall


def _iso_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def put_social_item(item: dict[str, Any]) -> None:
    get_table().put_item(Item=item)


def delete_item(pk: str, sk: str) -> None:
    get_table().delete_item(Key={"pk": pk, "sk": sk})


def is_blocked(tenant_id: str, blocker_id: str, blocked_id: str) -> bool:
    r = get_table().get_item(
        Key={"pk": pk_user(tenant_id, blocker_id), "sk": sk_block(blocked_id)},
    )
    return bool(r.get("Item"))


def add_block(tenant_id: str, blocker_id: str, blocked_id: str) -> None:
    now = _iso_now()
    put_social_item(
        {
            "pk": pk_user(tenant_id, blocker_id),
            "sk": sk_block(blocked_id),
            "entity_type": "BLOCK",
            "tenant_id": tenant_id,
            "blocker_user_id": blocker_id,
            "blocked_user_id": blocked_id,
            "created_at": now,
        }
    )
    # remove follow edges both ways
    try:
        delete_item(pk_user(tenant_id, blocker_id), sk_following(blocked_id))
    except Exception:
        pass
    try:
        delete_item(pk_user(tenant_id, blocked_id), sk_following(blocker_id))
    except Exception:
        pass


def add_follow(tenant_id: str, follower_id: str, followed_id: str) -> None:
    if follower_id == followed_id:
        return
    now = _iso_now()
    # outgoing
    put_social_item(
        {
            "pk": pk_user(tenant_id, follower_id),
            "sk": sk_following(followed_id),
            "entity_type": "FOLLOW",
            "tenant_id": tenant_id,
            "follower_user_id": follower_id,
            "followed_user_id": followed_id,
            "created_at": now,
            "gsi4_pk": gsi4_pk_followers(tenant_id, followed_id),
            "gsi4_sk": sk_follower(follower_id),
        }
    )


def remove_follow(tenant_id: str, follower_id: str, followed_id: str) -> None:
    delete_item(pk_user(tenant_id, follower_id), sk_following(followed_id))


def is_following(tenant_id: str, follower_id: str, followed_id: str) -> bool:
    r = get_table().get_item(
        Key={"pk": pk_user(tenant_id, follower_id), "sk": sk_following(followed_id)},
    )
    return bool(r.get("Item"))


def list_following(tenant_id: str, user_id: str) -> list[dict]:
    t = get_table()
    items: list[dict] = []
    kwargs: dict = {
        "KeyConditionExpression": Key("pk").eq(pk_user(tenant_id, user_id))
        & Key("sk").begins_with("FOLLOWING#"),
    }
    while True:
        r = t.query(**kwargs)
        items.extend(r.get("Items", []))
        lek = r.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek
    return items


def list_followers(tenant_id: str, user_id: str) -> list[dict]:
    t = get_table()
    items: list[dict] = []
    kwargs: dict = {
        "IndexName": "gsi_followers",
        "KeyConditionExpression": Key("gsi4_pk").eq(gsi4_pk_followers(tenant_id, user_id))
        & Key("gsi4_sk").begins_with("FOLLOWER#"),
    }
    while True:
        r = t.query(**kwargs)
        items.extend(r.get("Items", []))
        lek = r.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek
    return items


def add_wall_post(
    tenant_id: str,
    recipient_id: str,
    post_id: str,
    author_user_id: str,
    content: str,
    created_at_iso: str,
) -> dict[str, Any]:
    item = {
        "pk": pk_user(tenant_id, recipient_id),
        "sk": sk_wall(created_at_iso, post_id),
        "entity_type": "WALL_POST",
        "tenant_id": tenant_id,
        "post_id": post_id,
        "recipient_user_id": recipient_id,
        "author_user_id": author_user_id,
        "content": content,
        "created_at": created_at_iso,
    }
    put_social_item(item)
    return item


def list_wall_posts(tenant_id: str, recipient_id: str) -> list[dict]:
    t = get_table()
    items: list[dict] = []
    kwargs: dict = {
        "KeyConditionExpression": Key("pk").eq(pk_user(tenant_id, recipient_id))
        & Key("sk").begins_with("WALL#"),
    }
    while True:
        r = t.query(**kwargs)
        items.extend(r.get("Items", []))
        lek = r.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek
    return sorted(items, key=lambda x: x.get("sk", ""), reverse=True)
