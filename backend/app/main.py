from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, auth, insights, logging_api, me, users_api

app = FastAPI(title="MEN-Tool API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/v1")
app.include_router(me.router, prefix="/v1")
app.include_router(logging_api.router, prefix="/v1")
app.include_router(insights.router, prefix="/v1")
app.include_router(users_api.router, prefix="/v1")
app.include_router(admin.router, prefix="/v1")


@app.get("/v1/health")
def health():
    return {"status": "ok"}
