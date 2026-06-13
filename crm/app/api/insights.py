"""Customer insights (analytics for the dashboard charts) + proactive opportunities."""

from fastapi import APIRouter, Depends
from sqlmodel import Session

from ..db import get_session
from ..insights import compute_insights
from ..strategy import find_opportunities

router = APIRouter(tags=["insights"])


@router.get("/insights")
def insights(session: Session = Depends(get_session)):
    return compute_insights(session)


@router.get("/strategy/opportunities")
def opportunities(session: Session = Depends(get_session)):
    """The agent's proactive scan: the top plays in the base, each with a revenue forecast."""
    return {"opportunities": find_opportunities(session)}
