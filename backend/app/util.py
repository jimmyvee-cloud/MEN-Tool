"""Serialize DynamoDB types for JSON."""

from decimal import Decimal


def dynamo_to_json(obj):
    if isinstance(obj, list):
        return [dynamo_to_json(v) for v in obj]
    if isinstance(obj, dict):
        return {k: dynamo_to_json(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    return obj
