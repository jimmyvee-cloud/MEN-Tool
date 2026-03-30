# MEN-Tool

Men's personal performance tracking PWA — React + FastAPI + DynamoDB.

## Local development

1. Copy `.env.example` to `.env` and adjust if needed.
2. `docker compose up --build`
3. API: http://localhost:8001/v1/health
4. Frontend: http://localhost:5173
5. The **API container** runs `python -m scripts.ensure_dev_db` on startup (creates the DynamoDB table if needed and seeds the tenant once). If you ever need to re-seed from scratch, reset DynamoDB Local data and restart the API, or run manually: `docker compose exec api python -m scripts.init_db && docker compose exec api python -m scripts.seed`

Default admin (after seed): `admin@mentool.local` / `Admin12345!` (override with `SEED_ADMIN_PASSWORD`).

Password reset by email (user must already exist — register or Google-sign-in first):  
`docker compose exec api python -m scripts.reset_password you@example.com 'NewPass123!'`

To promote **your** email to admin after you register: set `SEED_PROMOTE_ADMIN_EMAILS=you@example.com` in `.env`, then  
`docker compose exec api python -m scripts.seed --promote-only`  
(There is no hardcoded owner email; leaving the variable unset does nothing.)

### API usage

All requests require header `X-API-Key` with the tenant plaintext key from seed (see `scripts/seed.py` output) or `MENTOOL_DEV_API_KEY` from `.env`.

## Project layout

- `backend/` — FastAPI app
- `frontend/` — Vite React PWA
- `infra/` — AWS CDK
- `scripts/` — DB init, seed utilities (mounted in backend image)
