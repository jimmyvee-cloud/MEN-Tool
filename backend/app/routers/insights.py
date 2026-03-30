from __future__ import annotations

from fastapi import APIRouter, Depends

from app.deps import AuthUser, get_current_user
from app.insights import build_insight_bundle
from app.util import dynamo_to_json

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("")
def insights(week_start: str | None = None, user: AuthUser = Depends(get_current_user)):
    bundle = build_insight_bundle(user.tenant_id, user.user_id, week_start)
    return dynamo_to_json(bundle)
