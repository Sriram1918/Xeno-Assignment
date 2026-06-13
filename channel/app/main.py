"""Stubbed channel service (WhatsApp/SMS/Email/RCS).

It delivers nothing. It accepts a send, simulates a realistic engagement funnel, and calls back
asynchronously into the CRM receipt API with what "happened". To make the CRM's robustness real
(not theoretical), it deliberately injects the messy parts of real channel delivery:
  - transient dispatch failures on /send  -> exercises the CRM's retry/backoff
  - bounces (undeliverable)                -> exercises terminal-failure handling
  - duplicate callbacks (same event_id)    -> exercises idempotency
  - independently-delayed callbacks        -> can arrive out of order at the CRM
"""

import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Taco Bell Channel Stub", version="0.2.0")

# Funnel probabilities (each conditional on the previous step).
P_DELIVERED = 0.92
P_OPENED = 0.62
P_READ = 0.85
P_CLICKED = 0.38
# Reliability gremlins.
P_TRANSIENT_SEND_FAILURE = 0.08   # /send returns 503 -> CRM retries
P_DUPLICATE_CALLBACK = 0.06       # same event delivered twice -> CRM dedupes


class SendIn(BaseModel):
    communication_id: str
    channel: str
    recipient: str
    message: str
    callback_url: str


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


def _build_funnel() -> list[str]:
    """Decide how far this particular message gets."""
    if random.random() >= P_DELIVERED:
        return ["bounced"]
    events = ["delivered"]
    if random.random() < P_OPENED:
        events.append("opened")
        if random.random() < P_READ:
            events.append("read")
            if random.random() < P_CLICKED:
                events.append("clicked")
    return events


async def _fire(client: httpx.AsyncClient, url: str, event_id: str, cid: str,
                event: str, occurred_at: str, delay: float) -> None:
    await asyncio.sleep(delay)
    try:
        await client.post(
            url,
            json={
                "event_id": event_id,
                "communication_id": cid,
                "event": event,
                "occurred_at": occurred_at,
            },
            timeout=10.0,
        )
    except Exception:  # noqa: BLE001 - best-effort callback, like a real provider
        pass


async def simulate(payload: SendIn) -> None:
    events = _build_funnel()
    base_time = datetime.now(timezone.utc).replace(tzinfo=None)

    async with httpx.AsyncClient() as client:
        tasks = []
        for i, event in enumerate(events):
            event_id = uuid.uuid4().hex
            # Logical event time is ordered; network delay is independent so arrival can reorder.
            occurred_at = (base_time + timedelta(seconds=i)).isoformat()
            delay = i * 1.2 + random.uniform(-0.5, 0.9)
            tasks.append(_fire(client, payload.callback_url, event_id,
                               payload.communication_id, event, occurred_at, max(delay, 0.05)))
            if random.random() < P_DUPLICATE_CALLBACK:
                # Same event_id, slightly later -> the CRM must dedupe it.
                tasks.append(_fire(client, payload.callback_url, event_id,
                                   payload.communication_id, event, occurred_at,
                                   max(delay, 0.05) + random.uniform(0.2, 0.8)))
        await asyncio.gather(*tasks, return_exceptions=True)


@app.post("/send")
async def send(payload: SendIn, background: BackgroundTasks):
    # Occasionally fail the dispatch itself so the CRM's retry path is real.
    if random.random() < P_TRANSIENT_SEND_FAILURE:
        raise HTTPException(status_code=503, detail="channel temporarily unavailable")
    background.add_task(simulate, payload)
    return {"status": "accepted", "communication_id": payload.communication_id}


@app.get("/health")
def health():
    return {"status": "ok", "service": "channel"}


@app.get("/")
def root():
    return {
        "service": "Taco Bell Channel Stub",
        "note": "Simulates WhatsApp/SMS/Email/RCS delivery. No real messages sent.",
        "health": "/health",
    }
