"""Reset a user's password by email. Usage:
  docker compose exec api python -m scripts.reset_password hi@example.com 'NewPass123!'
  # or from repo root with local DynamoDB:
  PYTHONPATH=backend python -m scripts.reset_password hi@example.com 'NewPass123!'
"""
from __future__ import annotations

import argparse
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND = os.path.join(ROOT, "backend")
if os.path.isdir(BACKEND):
    sys.path.insert(0, BACKEND)
if os.path.isdir("/app"):
    sys.path.insert(0, "/app")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("email")
    p.add_argument("password")
    p.add_argument("--tenant", default=os.environ.get("DEFAULT_TENANT_ID", "mentool"))
    args = p.parse_args()

    from datetime import UTC, datetime

    from app.repositories import users as users_repo
    from app.security import hash_password

    email = args.email.lower().strip()
    u = users_repo.get_user_by_email(args.tenant, email)
    if not u:
        print(f"No user with email {email!r} in tenant {args.tenant!r}", file=sys.stderr)
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
