import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DB tables are created here. Kept defensive so a missing/cold database never takes
    # down the health endpoint during early deploys.
    try:
        from . import models  # noqa: F401 - register tables on SQLModel.metadata
        from .db import init_db

        init_db()
    except Exception as exc:  # noqa: BLE001 - log and continue; health must stay up
        print(f"[startup] init_db skipped: {exc}")

    # Start the outbox dispatcher as a background task in the API process.
    from .worker import dispatcher_loop

    stop_event = asyncio.Event()
    worker_task = asyncio.create_task(dispatcher_loop(stop_event))
    try:
        yield
    finally:
        stop_event.set()
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Taco Bell CRM", version="0.5.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tightened later; fine for the assignment scope
    allow_methods=["*"],
    allow_headers=["*"],
)

from .api import (  # noqa: E402 - after app/middleware setup
    admin,
    agent,
    campaigns,
    demo,
    insights,
    receipts,
    segments,
)

app.include_router(admin.router)
app.include_router(segments.router)
app.include_router(campaigns.router)
app.include_router(receipts.router)
app.include_router(agent.router)
app.include_router(demo.router)
app.include_router(insights.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "crm", "env": settings.environment}


@app.get("/")
def root():
    return {"service": "Taco Bell CRM", "docs": "/docs", "health": "/health"}
