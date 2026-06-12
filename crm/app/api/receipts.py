"""Receipt callbacks from the channel service.

Two hard things the channel throws at us, handled here:
- **Duplicates.** The same event can arrive more than once (retries, at-least-once delivery).
  We record every event under its channel-issued `event_id` (primary key); a duplicate hits the
  PK conflict and is ignored. Stats never double-count.
- **Out-of-order.** A late "delivered" can arrive after "opened". The lifecycle is monotonic:
  we only advance `status` when the incoming rank is higher, but we still backfill the event's
  timestamp if it was missing — so the funnel stays accurate without ever regressing state.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from ..db import get_session
from ..models import (
    STATUS_RANK,
    TERMINAL_FAILURES,
    CommStatus,
    Communication,
    ReceiptEvent,
)
from ..schemas import ReceiptIn

router = APIRouter(prefix="/receipts", tags=["receipts"])

_POSITIVE_TS_FIELD = {
    CommStatus.delivered: "delivered_at",
    CommStatus.opened: "opened_at",
    CommStatus.read: "read_at",
    CommStatus.clicked: "clicked_at",
}


def _apply_event(comm: Communication, event: CommStatus, occurred_at) -> None:
    if comm.status in TERMINAL_FAILURES:
        return  # already dead; ignore anything further

    if event in TERMINAL_FAILURES:
        # A bounce/failure only makes sense before delivery; ignore if already delivered+.
        if comm.status_rank < STATUS_RANK[CommStatus.delivered]:
            comm.status = event
            comm.failed_at = occurred_at
        return

    # Positive lifecycle event. Backfill timestamp regardless of arrival order.
    field = _POSITIVE_TS_FIELD[event]
    if getattr(comm, field) is None:
        setattr(comm, field, occurred_at)
    if comm.sent_at is None:
        comm.sent_at = occurred_at  # a positive event implies it was sent

    rank = STATUS_RANK[event]
    if rank > comm.status_rank:  # only ever move forward
        comm.status = event
        comm.status_rank = rank


@router.post("")
def receive(evt: ReceiptIn, session: Session = Depends(get_session)):
    comm = session.get(Communication, evt.communication_id)
    if comm is None:
        raise HTTPException(status_code=404, detail="Unknown communication")

    # Idempotency: insert-and-flush; a duplicate event_id raises and is ignored.
    session.add(
        ReceiptEvent(
            id=evt.event_id,
            communication_id=evt.communication_id,
            event=evt.event,
            occurred_at=evt.occurred_at,
        )
    )
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        return {"status": "duplicate_ignored"}

    _apply_event(comm, evt.event, evt.occurred_at)
    session.add(comm)
    session.commit()
    return {"status": "applied", "communication_status": comm.status.value}
