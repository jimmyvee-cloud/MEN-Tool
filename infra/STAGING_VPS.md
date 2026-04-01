# MEN-Tool — VPS staging deployment

Guide for hosting **staging** on a single VPS: static PWA + FastAPI API + DynamoDB (recommended: **AWS DynamoDB** table from the existing CDK stack, or a dedicated table in the same AWS account).

Local dev uses `docker-compose` with DynamoDB Local; **staging should use real DynamoDB** so data and behavior match production.

---

## Architecture (staging)

| Layer | Role |
|--------|------|
| **TLS reverse proxy** | Caddy or nginx — HTTPS, route `/` → static files, `/v1` → API |
| **Frontend** | Built Vite app (`frontend/dist`) — SPA, env baked at **build** time |
| **API** | Container from [`backend/Dockerfile`](../backend/Dockerfile) — Uvicorn on port 8000 (internal) |
| **DynamoDB** | AWS table with same key/GSI schema as [`scripts/init_db.py`](../scripts/init_db.py) (CDK stack [`mentool_stack/stack.py`](mentool_stack/stack.py) matches this) |

---

## 1. AWS prerequisites (data layer)

1. Deploy the CDK stack (or create an equivalent table + GSIs manually):

   ```bash
   cd infra
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   cdk deploy MenToolStack
   ```

2. Note outputs: **Table name**, **JWT SSM parameter path** (if you use SSM on the VPS).

3. Put a real JWT secret in SSM (replace parameter name with your stack output):

   ```bash
   aws ssm put-parameter \
     --name /men-tool/mentoolstack/jwt_secret \
     --value "$(openssl rand -base64 48)" \
     --type SecureString \
     --overwrite
   ```

4. Create an **IAM user or role** for the VPS with least privilege:

   - `dynamodb:GetItem`, `PutItem`, `Query`, `UpdateItem`, `DeleteItem` (scoped to the staging table ARN)
   - `ssm:GetParameter` on the JWT secret ARN (only if `JWT_SECRET_SSM_PATH` is used)

5. Store **AWS access keys** securely on the host (env file readable only by root/docker, or instance role if the VPS is an EC2 in the same account).

---

## 2. Build the frontend (on CI or build machine)

From repo root, with **public URLs** for staging:

```bash
cd frontend
npm ci
export VITE_API_BASE_URL="https://api.staging.example.com"   # no trailing slash, no /v1
export VITE_API_KEY="<plaintext tenant API key>"               # must match value used when tenant was seeded (see seed output / MENTOOL_DEV_API_KEY)
export VITE_TENANT_ID="mentool"
export VITE_GOOGLE_CLIENT_ID="<Google OAuth Web client ID>.apps.googleusercontent.com"
npm run build
```

- **`VITE_*` are compiled into the JS bundle** — rebuild when API URL or client ID changes.
- **Google Cloud Console** → OAuth Web client → **Authorized JavaScript origins**: `https://staging.example.com` (and `https://api.staging.example.com` only if you load GIS from there; usually just the site origin).

Artifact: `frontend/dist/` — copy to the VPS (rsync, artifact in CI, etc.).

---

## 3. Build and run the API container

```bash
# From repo root
docker build -f backend/Dockerfile -t men-tool-api:staging .
```

**Runtime environment** (file or compose — do not commit secrets to git):

| Variable | Staging notes |
|----------|----------------|
| `DYNAMODB_TABLE_NAME` | CDK output table name (e.g. `men-tool-mentoolstack`) |
| `DYNAMODB_ENDPOINT_URL` | **Unset** (use real AWS) |
| `AWS_REGION` | e.g. `us-east-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM user for DynamoDB (+ SSM if used) |
| `JWT_SECRET` | Long random string **or** omit if using SSM |
| `JWT_SECRET_SSM_PATH` | e.g. `/men-tool/mentoolstack/jwt_secret` — backend loads secret at startup |
| `DEFAULT_TENANT_ID` | `mentool` unless you changed it |
| `MENTOOL_DEV_API_KEY` | Plaintext key used to **seed** the tenant `api_key_hash` (must match `VITE_API_KEY` in the frontend build) |
| `GOOGLE_OAUTH_CLIENT_ID` | Same Web client ID as `VITE_GOOGLE_CLIENT_ID` |

**Do not** set `DYNAMODB_ENDPOINT_URL` to a local URL unless you intentionally run DynamoDB Local on the VPS (not recommended for staging parity).

Example run:

```bash
docker run -d --name men-tool-api --restart unless-stopped \
  -p 127.0.0.1:8000:8000 \
  --env-file /etc/men-tool/api.env \
  men-tool-api:staging
```

Bind **127.0.0.1** so the API is only reachable via the reverse proxy on the same host.

---

## 4. Database bootstrap (once per environment)

The API image includes [`scripts/init_db.py`](../scripts/init_db.py) and [`scripts/seed.py`](../scripts/seed.py).

On the VPS (or any host with the same env as production API):

```bash
docker run --rm --env-file /etc/men-tool/api.env men-tool-api:staging \
  python -m scripts.init_db

docker run --rm --env-file /etc/men-tool/api.env men-tool-api:staging \
  python -m scripts.seed
```

- **`init_db`** creates the table if missing (skip if CDK already created it — script will detect existing table).
- **`seed`** inserts tenant metadata, default badges/presets, and a dev admin user (`admin@mentool.local` unless overridden — change password immediately or use only for bootstrap).

Optional: promote a real account after first login:

```bash
export SEED_PROMOTE_ADMIN_EMAILS="you@company.com"
docker run --rm -e SEED_PROMOTE_ADMIN_EMAILS --env-file /etc/men-tool/api.env men-tool-api:staging \
  python -m scripts.seed --promote-only
```

---

## 5. Reverse proxy and TLS

### Caddy (example)

Forward **`/v1` unchanged** to Uvicorn (do **not** strip the prefix — FastAPI routes are `/v1/...`).

```caddy
staging.example.com {
    @api path /v1*
    handle @api {
        reverse_proxy 127.0.0.1:8000
    }
    handle {
        root * /var/www/men-tool/dist
        file_server
        try_files {path} /index.html
    }
}
```

- SPA: `dist` + `try_files` for client-side routing.
- API: same host `https://staging.example.com/v1/...` when **`VITE_API_BASE_URL`** is `https://staging.example.com` (no `/v1` suffix in the env value).

**Important:** If the frontend was built with `VITE_API_BASE_URL=https://api.staging.example.com`, use a **separate vhost** for the API hostname pointing to the same backend, or rebuild the frontend with a single-origin URL.

**CORS:** The API allows broad origins in code today; for hardening before production, tighten `CORSMiddleware` in [`backend/app/main.py`](../backend/app/main.py) to your staging origins only.

---

## 6. Smoke checks

1. `curl -sS https://staging.example.com/v1/health` → `{"status":"ok"}`
2. Open staging site → login with seeded admin or registered user.
3. Google Sign-In: consent screen appears and callback hits your API (check API logs).

---

## 7. Operations checklist

- [ ] TLS certificates renewed (Caddy auto; or certbot for nginx).
- [ ] **JWT secret** rotated via SSM / env and API restarted.
- [ ] **Tenant API key** rotation: update hash in DynamoDB + rebuild frontend with new `VITE_API_KEY`.
- [ ] DynamoDB **PITR** enabled (CDK stack enables it).
- [ ] Backups / AWS-native DR per org policy.
- [ ] Logs: ship Docker logs or run a log driver to your aggregator.

---

## 8. What not to do on staging

- Do not reuse **DynamoDB Local** with `-inMemory` — data disappears on restart and behavior diverges from prod.
- Do not expose **port 8000** publicly; only the proxy on 443/80.
- Do not commit **`.env`** with real secrets; use a secrets manager or host-protected files.

---

## 9. Related docs

- AWS CDK data layer: [`infra/README.md`](README.md)
- App overview: [`../README.md`](../README.md)
