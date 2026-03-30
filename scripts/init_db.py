"""Create DynamoDB table (local or AWS). Run: python -m scripts.init_db"""

import boto3
import os

TABLE_NAME = os.environ.get("DYNAMODB_TABLE_NAME", "men-tool-dev")
REGION = os.environ.get("AWS_REGION", "us-east-1")
ENDPOINT = os.environ.get("DYNAMODB_ENDPOINT_URL")


def client():
    kw: dict = {"region_name": REGION}
    if ENDPOINT:
        kw["endpoint_url"] = ENDPOINT
    if os.environ.get("AWS_ACCESS_KEY_ID"):
        kw["aws_access_key_id"] = os.environ.get("AWS_ACCESS_KEY_ID")
        kw["aws_secret_access_key"] = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
    return boto3.client("dynamodb", **kw)


def main():
    c = client()
    try:
        c.describe_table(TableName=TABLE_NAME)
        print(f"Table {TABLE_NAME} already exists.")
        return
    except c.exceptions.ResourceNotFoundException:
        pass

    c.create_table(
        TableName=TABLE_NAME,
        BillingMode="PAY_PER_REQUEST",
        AttributeDefinitions=[
            {"AttributeName": "pk", "AttributeType": "S"},
            {"AttributeName": "sk", "AttributeType": "S"},
            {"AttributeName": "gsi1_pk", "AttributeType": "S"},
            {"AttributeName": "gsi1_sk", "AttributeType": "S"},
            {"AttributeName": "gsi2_pk", "AttributeType": "S"},
            {"AttributeName": "gsi2_sk", "AttributeType": "S"},
            {"AttributeName": "gsi3_pk", "AttributeType": "S"},
            {"AttributeName": "gsi3_sk", "AttributeType": "S"},
            {"AttributeName": "gsi4_pk", "AttributeType": "S"},
            {"AttributeName": "gsi4_sk", "AttributeType": "S"},
        ],
        KeySchema=[
            {"AttributeName": "pk", "KeyType": "HASH"},
            {"AttributeName": "sk", "KeyType": "RANGE"},
        ],
        GlobalSecondaryIndexes=[
            {
                "IndexName": "gsi_email",
                "KeySchema": [
                    {"AttributeName": "gsi1_pk", "KeyType": "HASH"},
                    {"AttributeName": "gsi1_sk", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "gsi_invite",
                "KeySchema": [
                    {"AttributeName": "gsi2_pk", "KeyType": "HASH"},
                    {"AttributeName": "gsi2_sk", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "gsi_tenant_users",
                "KeySchema": [
                    {"AttributeName": "gsi3_pk", "KeyType": "HASH"},
                    {"AttributeName": "gsi3_sk", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
            {
                "IndexName": "gsi_followers",
                "KeySchema": [
                    {"AttributeName": "gsi4_pk", "KeyType": "HASH"},
                    {"AttributeName": "gsi4_sk", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            },
        ],
    )
    c.get_waiter("table_exists").wait(
        TableName=TABLE_NAME, WaiterConfig={"Delay": 1, "MaxAttempts": 30}
    )
    print(f"Created table {TABLE_NAME}")


if __name__ == "__main__":
    main()
