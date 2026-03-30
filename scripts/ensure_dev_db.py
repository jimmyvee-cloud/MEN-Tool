"""Wait for DynamoDB, create table if needed, seed tenant once (local / Docker dev)."""

from __future__ import annotations

import os
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND = os.path.join(ROOT, "backend")
if os.path.isdir(BACKEND):
    sys.path.insert(0, BACKEND)
if os.path.isdir("/app"):
    sys.path.insert(0, "/app")

TENANT_ID = os.environ.get("DEFAULT_TENANT_ID", "mentool")


def _wait_dynamodb() -> None:
    import botocore.exceptions

    from scripts import init_db

    last: Exception | None = None
    for _ in range(90):
        try:
            init_db.main()
            return
        except (
            botocore.exceptions.ClientError,
            botocore.exceptions.EndpointConnectionError,
            ConnectionRefusedError,
            OSError,
        ) as e:
            last = e
            time.sleep(1)
    raise RuntimeError(f"DynamoDB not reachable after wait: {last}") from last


def _tenant_exists() -> bool:
    import boto3
    import botocore.exceptions

    table_name = os.environ.get("DYNAMODB_TABLE_NAME", "men-tool-dev")
    region = os.environ.get("AWS_REGION", "us-east-1")
    endpoint = os.environ.get("DYNAMODB_ENDPOINT_URL")
    kw: dict = {"region_name": region}
    if endpoint:
        kw["endpoint_url"] = endpoint
    if os.environ.get("AWS_ACCESS_KEY_ID"):
        kw["aws_access_key_id"] = os.environ["AWS_ACCESS_KEY_ID"]
        kw["aws_secret_access_key"] = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
    t = boto3.resource("dynamodb", **kw).Table(table_name)
    try:
        r = t.get_item(Key={"pk": f"TENANT#{TENANT_ID}", "sk": "META"})
    except botocore.exceptions.ClientError as e:
        if e.response.get("Error", {}).get("Code") == "ResourceNotFoundException":
            return False
        raise
    return bool(r.get("Item"))


def main() -> None:
    _wait_dynamodb()
    if _tenant_exists():
        print("ensure_dev_db: tenant already seeded, skipping seed.")
        return
    from scripts import seed

    seed.main()


if __name__ == "__main__":
    main()
