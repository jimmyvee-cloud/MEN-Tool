import boto3

from app.config import get_settings


def get_dynamodb_resource():
    """Use explicit keys from Settings when both set; otherwise boto3's default chain (env, IAM role, ~/.aws)."""
    s = get_settings()
    session_kw: dict = {"region_name": s.aws_region}
    if s.aws_access_key_id and s.aws_secret_access_key:
        session_kw["aws_access_key_id"] = s.aws_access_key_id
        session_kw["aws_secret_access_key"] = s.aws_secret_access_key
    session = boto3.Session(**session_kw)

    resource_kw: dict = {}
    if s.dynamodb_endpoint_url:
        resource_kw["endpoint_url"] = s.dynamodb_endpoint_url
    return session.resource("dynamodb", **resource_kw)


def get_table():
    s = get_settings()
    return get_dynamodb_resource().Table(s.dynamodb_table_name)
