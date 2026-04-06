from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _discover_env_files() -> tuple[Path, ...]:
    """Load .env from repo root, backend, package dir, or cwd — not only process cwd."""
    seen: list[Path] = []
    d = Path(__file__).resolve().parent
    for _ in range(8):
        candidate = d / ".env"
        if candidate.is_file():
            p = candidate.resolve()
            if p not in seen:
                seen.append(p)
        if d.parent == d:
            break
        d = d.parent
    cwd_env = (Path.cwd() / ".env").resolve()
    if cwd_env.is_file() and cwd_env not in seen:
        seen.append(cwd_env)
    return tuple(seen)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_discover_env_files(),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    dynamodb_table_name: str = "men-tool-dev"
    dynamodb_endpoint_url: str | None = None
    aws_region: str = Field(
        default="us-east-1",
        validation_alias=AliasChoices("AWS_REGION", "AWS_DEFAULT_REGION"),
    )
    aws_access_key_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("AWS_ACCESS_KEY_ID", "aws_access_key_id"),
    )
    aws_secret_access_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("AWS_SECRET_ACCESS_KEY", "aws_secret_access_key"),
    )

    @field_validator(
        "dynamodb_endpoint_url",
        "aws_access_key_id",
        "aws_secret_access_key",
        mode="before",
    )
    @classmethod
    def empty_str_to_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    default_tenant_id: str = "mentool"
    # Plaintext dev API key must match tenant row (we store bcrypt hash in DB; dev seed stores dev key hash)
    mentool_dev_api_key: str = "dev-tenant-api-key-change-me"

    # Web client ID from Google Cloud (OAuth 2.0). Empty disables POST /auth/google.
    google_oauth_client_id: str = ""

    jwt_secret_ssm_path: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
