from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.badge_engine import evaluate_badges_after_action
from app.deps import AuthUser, get_current_user
from app.gamification import XP_CHECKIN, XP_RELIEF, XP_STRESSOR
from app.repositories import logs as logs_repo
from app.repositories import presets as presets_repo
from app.repositories import users as users_repo
from app.schemas import CheckInCreate, PresetCreate, ReliefCreate, StressorCreate
from app.util import dynamo_to_json

router = APIRouter(tags=["logs"])


def _iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


@router.get("/checkins")
def list_checkins(user: AuthUser = Depends(get_current_user)):
    items = logs_repo.list_checkins(user.tenant_id, user.user_id)
    return dynamo_to_json([x for x in items if not x.get("is_deleted")])


@router.post("/checkins")
def create_checkin(body: CheckInCreate, user: AuthUser = Depends(get_current_user)):
    logged = body.logged_at or _iso()
    cid = str(uuid.uuid4())
    item = logs_repo.build_checkin_item(
        tenant_id=user.tenant_id,
        user_id=user.user_id,
        checkin_id=cid,
        logged_at_iso=logged,
        mood_score=body.mood_score,
        note=body.note,
        created_at_iso=_iso(),
    )
    logs_repo.put_log(item)
    users_repo.increment_xp(user.tenant_id, user.user_id, XP_CHECKIN)
    badges_unlocked = evaluate_badges_after_action(user.tenant_id, user.user_id, "checkin")
    # profile step: first checkin
    u = users_repo.get_user(user.tenant_id, user.user_id)
    steps = int(u.get("profile_steps_completed", 0))
    if steps < 3 and len(logs_repo.list_checkins(user.tenant_id, user.user_id)) >= 1:
        users_repo.update_user_fields(
            user.tenant_id,
            user.user_id,
            {"profile_steps_completed": max(steps, 3), "updated_at": _iso()},
        )
    body = dynamo_to_json(item)
    if isinstance(body, dict):
        body["badges_unlocked"] = dynamo_to_json(badges_unlocked)
    return body


@router.get("/stressors")
def list_stressors(user: AuthUser = Depends(get_current_user)):
    items = logs_repo.list_stressors(user.tenant_id, user.user_id)
    return dynamo_to_json([x for x in items if not x.get("is_deleted")])


@router.post("/stressors")
def create_stressor(body: StressorCreate, user: AuthUser = Depends(get_current_user)):
    logged = body.logged_at or _iso()
    sid = str(uuid.uuid4())
    item = logs_repo.build_stressor_item(
        tenant_id=user.tenant_id,
        user_id=user.user_id,
        stressor_id=sid,
        logged_at_iso=logged,
        title=body.title.strip(),
        category=body.category,
        intensity=body.intensity,
        preset_id=body.preset_id,
        notes=body.notes,
        created_at_iso=_iso(),
    )
    logs_repo.put_log(item)
    users_repo.increment_xp(user.tenant_id, user.user_id, XP_STRESSOR)
    badges_unlocked = evaluate_badges_after_action(user.tenant_id, user.user_id, "stressor")
    body = dynamo_to_json(item)
    if isinstance(body, dict):
        body["badges_unlocked"] = dynamo_to_json(badges_unlocked)
    return body


@router.get("/reliefs")
def list_reliefs(user: AuthUser = Depends(get_current_user)):
    items = logs_repo.list_reliefs(user.tenant_id, user.user_id)
    return dynamo_to_json([x for x in items if not x.get("is_deleted")])


@router.post("/reliefs")
def create_relief(body: ReliefCreate, user: AuthUser = Depends(get_current_user)):
    logged = body.logged_at or _iso()
    rid = str(uuid.uuid4())
    item = logs_repo.build_relief_item(
        tenant_id=user.tenant_id,
        user_id=user.user_id,
        relief_id=rid,
        logged_at_iso=logged,
        title=body.title.strip(),
        category=body.category,
        duration_seconds=body.duration_seconds,
        effectiveness=body.effectiveness,
        focus=body.focus,
        preset_id=body.preset_id,
        youtube_url=body.youtube_url,
        notes=body.notes,
        created_at_iso=_iso(),
    )
    logs_repo.put_log(item)
    users_repo.increment_xp(user.tenant_id, user.user_id, XP_RELIEF)
    badges_unlocked = evaluate_badges_after_action(user.tenant_id, user.user_id, "relief")
    body = dynamo_to_json(item)
    if isinstance(body, dict):
        body["badges_unlocked"] = dynamo_to_json(badges_unlocked)
    return body


@router.get("/presets")
def list_presets(user: AuthUser = Depends(get_current_user)):
    items = presets_repo.list_presets_for_tenant(user.tenant_id, user.user_id)
    return dynamo_to_json(items)


@router.get("/presets/{preset_id}")
def get_preset(preset_id: str, user: AuthUser = Depends(get_current_user)):
    p = presets_repo.get_preset_by_id(user.tenant_id, preset_id, user.user_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Preset not found")
    return dynamo_to_json(p)


@router.post("/presets")
def create_preset(body: PresetCreate, user: AuthUser = Depends(get_current_user)):
    pid = str(uuid.uuid4())
    item = presets_repo.build_preset_item(
        tenant_id=user.tenant_id,
        preset_id=pid,
        user_id_creator=user.user_id,
        is_global=False,
        entity_type=body.preset_entity,
        title=body.title.strip(),
        category=body.category,
        becomehim_stage=body.becomehim_stage,
        duration_seconds=body.duration_seconds,
        youtube_url=body.youtube_url,
        description=body.description,
        created_at_iso=_iso(),
    )
    presets_repo.put_preset(item)
    return dynamo_to_json(item)
