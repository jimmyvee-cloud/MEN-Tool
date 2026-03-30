import boto3

from app.config import get_settings


def get_dynamodb_resource():
    s = get_settings()
    kwargs: dict = {"region_name": s.aws_region}
    if s.dynamodb_endpoint_url:
        kwargs["endpoint_url"] = s.dynamodb_endpoint_url
    if s.aws_access_key_id and s.aws_secret_access_key:
        kwargs["aws_access_key_id"] = s.aws_access_key_id
        kwargs["aws_secret_access_key"] = s.aws_secret_access_key
    return boto3.resource("dynamodb", **kwargs)


def get_table():
    s = get_settings()
    return get_dynamodb_resource().Table(s.dynamodb_table_name)
