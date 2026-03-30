from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, model_validator


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1, max_length=80)
    invite_code: str | None = None


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshBody(BaseModel):
    refresh_token: str


class CheckInCreate(BaseModel):
    mood_score: int = Field(ge=0, le=10)
    note: str | None = None
    logged_at: str | None = None  # ISO, optional client clock


class StressorCreate(BaseModel):
    title: str = Field(min_length=1)
    category: str
    intensity: int = Field(ge=0, le=10)
    preset_id: str | None = None
    notes: str | None = None
    logged_at: str | None = None


class ReliefCreate(BaseModel):
    title: str = Field(min_length=1)
    category: str
    duration_seconds: int = Field(ge=0)
    effectiveness: int = Field(ge=0, le=10)
    focus: int = Field(ge=0, le=10)
    preset_id: str | None = None
    youtube_url: str | None = None
    notes: str | None = None
    logged_at: str | None = None


class PresetCreate(BaseModel):
    preset_entity: str = Field(pattern="^(stressor|relief)$")
    title: str
    category: str
    becomehim_stage: str | None = None
    duration_seconds: int | None = None
    youtube_url: str | None = None
    description: str | None = None


class ProfilePatch(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None
    timezone: str | None = Field(default=None, max_length=80)
    profile_steps_completed: int | None = Field(default=None, ge=0, le=5)


class WallPostCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class AdminUserPatch(BaseModel):
    """Admin updates to another tenant user. At least one field required."""

    tier: str | None = Field(default=None, pattern="^(free|premium|admin)$")
    is_active: bool | None = None

    @model_validator(mode="after")
    def at_least_one_field(self):
        if self.tier is None and self.is_active is None:
            raise ValueError("Provide tier and/or is_active")
        return self
