"""Public demo controls: reset the dataset to a pristine state.

Exposed without the admin token so a reviewer can restore the demo from the UI (e.g. after
win-back campaigns have moved customers out of the lapsed segment). It fully clears campaigns,
communications and receipts, then regenerates customers + orders.
"""

from fastapi import APIRouter, Depends
from sqlmodel import Session, delete

from ..db import get_session
from ..models import Campaign, Communication, Customer, Order, ReceiptEvent
from ..seed import seed_database

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/reset")
def reset_demo(session: Session = Depends(get_session)):
    # Delete in FK-safe order: receipts -> comms -> campaigns -> orders -> customers.
    session.exec(delete(ReceiptEvent))
    session.exec(delete(Communication))
    session.exec(delete(Campaign))
    session.exec(delete(Order))
    session.exec(delete(Customer))
    session.commit()
    summary = seed_database(session, n_customers=2500, reset=False)
    return {"status": "reset", **summary}
