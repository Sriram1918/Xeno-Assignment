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


@router.post("/recreate")
def recreate(token: str = Query(..., description="Admin token")):
    """Drop and recreate all tables from the current models. Use after a schema change
    (SQLModel's create_all never alters existing tables). Destructive: re-seed afterwards."""
    _require_token(token)
    from sqlmodel import SQLModel

    from .. import models  # noqa: F401 - ensure all tables are registered
    from ..db import engine

    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    return {"status": "recreated", "tables": sorted(SQLModel.metadata.tables.keys())}


@router.get("/stats")
def stats(session: Session = Depends(get_session)):
    return summarize(session)


@router.get("/dbcheck")
def dbcheck():
    """Diagnostic: reports DB scheme, connectivity and table state. No secrets exposed."""
    from sqlalchemy import text
    from sqlmodel import select

    from ..db import engine
    from ..models import Customer

    raw = settings.database_url
    info = {
        "url_scheme": raw.split("://", 1)[0] if "://" in raw else "unknown",
        "uses_internal_network": "railway.internal" in raw,
    }
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        info["connect"] = "ok"
    except Exception as exc:  # noqa: BLE001
        info["connect_error"] = f"{type(exc).__name__}: {exc}"
        return info
    try:
        with Session(engine) as s:
            info["customer_count"] = len(s.exec(select(Customer)).all())
    except Exception as exc:  # noqa: BLE001
        info["query_error"] = f"{type(exc).__name__}: {exc}"
    return info
