# MEN-Tool

Men's personal performance tracking PWA — React + FastAPI + DynamoDB.

## Local development

1. Copy `.env.example` to `.env` and adjust if needed.
2. `docker compose up --build`
3. API: http://localhost:8001/v1/health
4. Frontend: http://localhost:5173
5. Create table + seed: `docker compose exec api python -m scripts.init_db && docker compose exec api python -m scripts.seed`

Default admin (after seed): `admin@mentool.local` / `Admin12345!` (override with `SEED_ADMIN_PASSWORD`).

### API usage

All requests require header `X-API-Key` with the tenant plaintext key from seed (see `scripts/seed.py` output) or `MENTOOL_DEV_API_KEY` from `.env`.

## Project layout

- `backend/` — FastAPI app
- `frontend/` — Vite React PWA
- `infra/` — AWS CDK
- `scripts/` — DB init, seed utilities (mounted in backend image)
