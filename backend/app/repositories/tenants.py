from app.db import get_table
from app.keys import pk_tenant, sk_tenant_meta


def get_tenant(tenant_id: str) -> dict | None:
    t = get_table()
    r = t.get_item(Key={"pk": pk_tenant(tenant_id), "sk": sk_tenant_meta()})
    return r.get("Item")
