"""Admin endpoints: seed and inspect demo data.

`seed`/`reset` are destructive, so they require the admin token. `stats` is read-only and open
so the dashboard (and reviewers) can always see the current data story.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from ..config import settings
from ..db import get_session
from ..seed import seed_database, summarize

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_token(token: str) -> None:
    if token != settings.admin_token:
        raise HTTPException(status_code=403, detail="Invalid admin token")


@router.post("/seed")
def seed(
    token: str = Query(..., description="Admin token"),
    n: int = Query(2500, ge=1, le=20000, description="Number of customers to generate"),
    reset: bool = Query(True, description="Wipe existing data first"),
    session: Session = Depends(get_session),
):
    _require_token(token)
    summary = seed_database(session, n_customers=n, reset=reset)
    return {"status": "seeded", **summary}


@router.post("/reset")
def reset(
    token: str = Query(..., description="Admin token"),
    session: Session = Depends(get_session),
):
    _require_token(token)
    from ..models import Customer, Order
    from sqlmodel import delete

    session.exec(delete(Order))
    session.exec(delete(Customer))
    session.commit()
    return {"status": "reset", "total_customers": 0, "total_orders": 0}


@router.get("/stats")
def stats(session: Session = Depends(get_session)):
    return summarize(session)
