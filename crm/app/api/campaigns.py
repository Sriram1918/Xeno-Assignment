"""Campaign lifecycle: create a draft, launch it (materialise the outbox), inspect stats."""

import json
import random

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..attribution import attribution_report, simulate_conversions
from ..db import get_session
from ..funnels import funnel as _funnel
from ..messaging import DEFAULT_TEMPLATES, recipient_for, render_message
from ..models import Campaign, CampaignStatus, Channel, Communication, utcnow

# Below this lifetime value, route to free Email instead of paid WhatsApp (cost strategy).
LOW_VALUE_THRESHOLD = 2000.0
from ..schemas import CampaignCreate, SegmentSpec
from ..segments import run_segment

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.post("")
def create_campaign(body: CampaignCreate, session: Session = Depends(get_session)):
    """Create a DRAFT campaign. Nothing is sent until /launch (the human approval gate)."""
    customers = run_segment(session, body.segment_spec)
    campaign = Campaign(
        name=body.name,
        goal=body.goal,
        segment_spec=body.segment_spec.model_dump_json(),
        messages=json.dumps(body.messages or {}),
        holdout_percent=body.holdout_percent,
        audience_size=len(customers),
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)
    return {"campaign": campaign, "audience_size": len(customers)}


@router.post("/{campaign_id}/launch")
def launch_campaign(
    campaign_id: str,
    channel_strategy: str = "preferred",  # "preferred" or "cost" (low-value -> free Email)
    session: Session = Depends(get_session),
):
    campaign = session.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != CampaignStatus.draft:
        raise HTTPException(status_code=400, detail=f"Campaign already {campaign.status.value}")

    spec = SegmentSpec.model_validate_json(campaign.segment_spec)
    messages = json.loads(campaign.messages) or {}
    customers = run_segment(session, spec)
    if not customers:
        raise HTTPException(status_code=400, detail="Segment is empty; nothing to launch")

    # Randomly hold back a control group so we can measure true lift later.
    random.shuffle(customers)
    n_holdout = int(len(customers) * campaign.holdout_percent / 100)
    holdout_ids = {c.id for c in customers[:n_holdout]}

    comms: list[Communication] = []
    for c in customers:
        # Cost strategy: send low-value customers via free Email instead of paid WhatsApp.
        if channel_strategy == "cost" and c.lifetime_value < LOW_VALUE_THRESHOLD:
            channel = Channel.email
        else:
            channel = c.preferred_channel
        template = messages.get(channel.value) or DEFAULT_TEMPLATES[channel.value]
        comms.append(
            Communication(
                campaign_id=campaign.id,
                customer_id=c.id,
                channel=channel,
                recipient=recipient_for(c, channel),
                message=render_message(template, c),
                is_holdout=c.id in holdout_ids,
            )
        )
    session.add_all(comms)

    campaign.status = CampaignStatus.launched
    campaign.launched_at = utcnow()
    campaign.audience_size = len(customers)
    campaign.holdout_size = n_holdout
    session.add(campaign)
    session.commit()

    return {
        "status": "launched",
        "campaign_id": campaign.id,
        "audience_size": len(customers),
        "targeted": len(customers) - n_holdout,
        "holdout": n_holdout,
    }


@router.get("")
def list_campaigns(session: Session = Depends(get_session)):
    campaigns = session.exec(select(Campaign).order_by(Campaign.created_at.desc())).all()
    return [
        {**c.model_dump(), "funnel": _funnel(session, c.id) if c.status != CampaignStatus.draft else None}
        for c in campaigns
    ]


@router.get("/{campaign_id}")
def get_campaign(campaign_id: str, session: Session = Depends(get_session)):
    campaign = session.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {**campaign.model_dump(), "funnel": _funnel(session, campaign.id)}


@router.get("/{campaign_id}/stats")
def campaign_stats(campaign_id: str, session: Session = Depends(get_session)):
    if session.get(Campaign, campaign_id) is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return _funnel(session, campaign_id)


@router.post("/{campaign_id}/simulate-conversions")
def simulate_campaign_conversions(campaign_id: str, session: Session = Depends(get_session)):
    """Demo 'fast-forward a week': generate post-campaign orders with an engagement-driven
    causal effect, so the holdout-based attribution has real outcomes to measure."""
    campaign = session.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != CampaignStatus.launched:
        raise HTTPException(status_code=400, detail="Campaign must be launched first")
    return simulate_conversions(session, campaign)


@router.get("/{campaign_id}/attribution")
def campaign_attribution(campaign_id: str, session: Session = Depends(get_session)):
    """Holdout-validated attribution: lift, incremental conversions, recovered revenue."""
    campaign = session.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return attribution_report(session, campaign)
