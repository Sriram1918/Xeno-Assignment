"""Shared funnel computation for a campaign (used by the campaigns API and the AI report)."""

from sqlmodel import Session, select

from .models import TERMINAL_FAILURES, CommStatus, Communication


def funnel(session: Session, campaign_id: str) -> dict:
    comms = session.exec(
        select(Communication).where(Communication.campaign_id == campaign_id)
    ).all()
    targeted = [c for c in comms if not c.is_holdout]
    return {
        "audience": len(comms),
        "holdout": sum(c.is_holdout for c in comms),
        "targeted": len(targeted),
        "queued": sum(c.status == CommStatus.queued for c in targeted),
        "sent": sum(c.sent_at is not None for c in targeted),
        "delivered": sum(c.delivered_at is not None for c in targeted),
        "opened": sum(c.opened_at is not None for c in targeted),
        "read": sum(c.read_at is not None for c in targeted),
        "clicked": sum(c.clicked_at is not None for c in targeted),
        "failed": sum(c.status in TERMINAL_FAILURES for c in targeted),
    }
