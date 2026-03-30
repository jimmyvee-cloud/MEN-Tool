"""Reset a user's password by email. Usage:
  docker compose exec api python -m scripts.reset_password hi@example.com 'NewPass123!'
  # or from repo root with local DynamoDB:
  PYTHONPATH=backend python -m scripts.reset_password hi@example.com 'NewPass123!'

Use the same DB as your API: prefer `docker compose exec api` so DYNAMODB_* and
DEFAULT_TENANT_ID match. If you see "No user" here but registration says "email
already taken", the script is pointing at a different table or tenant than the API.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND = os.path.join(ROOT, "backend")
if os.path.isdir(BACKEND):
    sys.path.insert(0, BACKEND)
if os.path.isdir("/app"):
    sys.path.insert(0, "/app")


def _load_root_dotenv() -> None:
    """Pre-fill os.environ from repo `.env` when vars are unset (host runs)."""
    path = Path(ROOT) / ".env"
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("email")
    p.add_argument("password")
    p.add_argument("--tenant", default=os.environ.get("DEFAULT_TENANT_ID", "mentool"))
    args = p.parse_args()

    _load_root_dotenv()

    from datetime import UTC, datetime

    from app.config import get_settings
    from app.repositories import users as users_repo
    from app.security import hash_password

    s = get_settings()
    print(
        f"DB: table={s.dynamodb_table_name!r} endpoint={s.dynamodb_endpoint_url!r} "
        f"tenant={args.tenant!r}",
        file=sys.stderr,
    )

    email = args.email.lower().strip()
    u = users_repo.get_user_by_email(args.tenant, email)
    if not u:
        print(
            f"No user with email {email!r} in tenant {args.tenant!r} (see DB line above).\n"
            "That email has no PROFILE row in this table. Common cases:\n"
            "  • Sign up in the app (email/password or Google) first — then run this script.\n"
            "  • Google-only: use the exact Google account email shown in the app / DB.\n"
            "  • Wrong DB: run via `docker compose exec api` so DYNAMODB_* matches the API.\n"
            "  • Fresh in-memory DynamoDB: data was wiped; register again or re-seed.\n"
            "Dev seed includes admin@mentool.local (password from SEED_ADMIN_PASSWORD / README).",
            file=sys.stderr,
        )
        sys.exit(1)
    uid = u["user_id"]
    h = hash_password(args.password)
    now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    users_repo.update_user_fields(
        args.tenant, uid, {"password_hash": h, "updated_at": now}
    )
    print(f"Updated password for {email} (user_id={uid})")


if __name__ == "__main__":
    main()
