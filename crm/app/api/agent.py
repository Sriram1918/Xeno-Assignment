"""AI agent endpoints: propose a campaign from a goal, and report on results.

The approval gate lives between these: /agent/plan proposes (no send), the marketer reviews, then
the normal /campaigns create+launch flow executes. /agent/report narrates the outcome.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ..agent import generate_report, propose_campaign
from ..db import get_session
from ..models import Campaign

router = APIRouter(prefix="/agent", tags=["agent"])


class GoalIn(BaseModel):
    goal: str


@router.post("/plan")
def plan(body: GoalIn, session: Session = Depends(get_session)):
    """Propose a campaign: typed segment + live audience preview + per-channel copy. Sends nothing."""
    try:
        return propose_campaign(session, body.goal)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:  # noqa: BLE001 - surface model/parse errors cleanly to the UI
        raise HTTPException(status_code=502, detail=f"Agent planning failed: {exc}")


@router.post("/report/{campaign_id}")
def report(campaign_id: str, session: Session = Depends(get_session)):
    campaign = session.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    try:
        return generate_report(session, campaign)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Agent report failed: {exc}")
