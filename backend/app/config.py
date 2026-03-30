from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    dynamodb_table_name: str = "men-tool-dev"
    dynamodb_endpoint_url: str | None = None
    aws_region: str = "us-east-1"
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None

    default_tenant_id: str = "mentool"
    # Plaintext dev API key must match tenant row (we store bcrypt hash in DB; dev seed stores dev key hash)
    mentool_dev_api_key: str = "dev-tenant-api-key-change-me"

    # Web client ID from Google Cloud (OAuth 2.0). Empty disables POST /auth/google.
    google_oauth_client_id: str = ""

    jwt_secret_ssm_path: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
