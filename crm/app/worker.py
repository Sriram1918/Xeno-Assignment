"""Outbox dispatcher: a background task that drains queued communications to the channel.

Design choices (and their tradeoffs), which are the system-design story:
- **Outbox pattern.** Launching a campaign only writes `Communication` rows (status=queued) in
  the same DB transaction. This loop is the *only* thing that talks to the channel, so a crash
  mid-launch never half-sends — unsent rows simply stay queued and get picked up later.
- **At-least-once + idempotency.** We may send a row more than once on retries; correctness comes
  from the channel/receipt side being idempotent (receipts are deduped by event id).
- **Concurrency.** Each tick dispatches a batch concurrently (asyncio.gather) for throughput.
- **Retry with exponential backoff + dead-letter.** Transient channel failures are retried with
  growing delay; after MAX_ATTEMPTS the row is parked as `failed` (a dead-letter), not retried forever.
- **Scope tradeoff.** One in-process worker, claiming rows with a simple query. At real scale I'd
  run this as a separate process and claim rows with `SELECT ... FOR UPDATE SKIP LOCKED` (or move
  to a broker like SQS/Redis). For this assignment, one worker is plenty and far simpler to reason about.
"""

import asyncio
from datetime import timedelta

import httpx
from sqlmodel import Session, or_, select

from .channel_client import dispatch
from .db import engine
from .models import CommStatus, Communication, utcnow

MAX_ATTEMPTS = 5
BATCH_SIZE = 50
IDLE_POLL_SECONDS = 2.0


def _backoff(attempts: int) -> timedelta:
    return timedelta(seconds=min(2 ** attempts, 60))  # 2,4,8,16,32,60s cap


async def process_batch() -> int:
    """Dispatch one batch of due, queued, non-holdout communications. Returns count processed."""
    now = utcnow()
    with Session(engine) as session:
        stmt = (
            select(Communication)
            .where(Communication.status == CommStatus.queued)
            .where(Communication.is_holdout == False)  # noqa: E712
            .where(
                or_(
                    Communication.next_retry_at == None,  # noqa: E711
                    Communication.next_retry_at <= now,
                )
            )
            .order_by(Communication.created_at)
            .limit(BATCH_SIZE)
        )
        batch = session.exec(stmt).all()
        if not batch:
            return 0

        async with httpx.AsyncClient() as client:
            results = await asyncio.gather(
                *(dispatch(client, comm) for comm in batch), return_exceptions=True
            )

        for comm, result in zip(batch, results):
            comm.attempts += 1
            if isinstance(result, Exception):
                comm.last_error = f"{type(result).__name__}: {result}"[:300]
                if comm.attempts >= MAX_ATTEMPTS:
                    comm.status = CommStatus.failed  # dead-letter
                    comm.failed_at = utcnow()
                    comm.next_retry_at = None
                else:
                    comm.next_retry_at = utcnow() + _backoff(comm.attempts)
            else:
                comm.status = CommStatus.sent
                comm.status_rank = 1
                comm.sent_at = utcnow()
                comm.last_error = None
                comm.next_retry_at = None
            session.add(comm)
        session.commit()
        return len(batch)


async def dispatcher_loop(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            processed = await process_batch()
        except Exception as exc:  # noqa: BLE001 - keep the loop alive through transient errors
            print(f"[worker] batch error: {exc}")
            processed = 0
        # Drain quickly when busy; idle-poll gently when empty.
        await asyncio.sleep(0.2 if processed else IDLE_POLL_SECONDS)
