from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DB tables are created here once models exist. Kept defensive so a missing/cold
    # database never takes down the health endpoint during early deploys.
    try:
        from .db import init_db

        init_db()
    except Exception as exc:  # noqa: BLE001 - log and continue; health must stay up
        print(f"[startup] init_db skipped: {exc}")
    yield


app = FastAPI(title="Taco Town CRM", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tightened later; fine for the assignment scope
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "crm", "env": settings.environment}


@app.get("/")
def root():
    return {"service": "Taco Town CRM", "docs": "/docs", "health": "/health"}
