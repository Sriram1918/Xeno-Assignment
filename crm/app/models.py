"""Database models for the Taco Town CRM.

Design note: we keep classic RFM fields (recency / frequency / monetary) denormalised
on the Customer row — `last_order_at`, `order_count`, `lifetime_value` — and refresh them
whenever orders are ingested. Segmentation ("regulars who went quiet") then becomes a fast,
index-backed query instead of a per-request aggregation over the orders table. At much larger
scale we'd move this to a warehouse / materialised view; for this scope, denormalised columns
are the right tradeoff.
"""

import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlmodel import Field, SQLModel


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    """Naive UTC timestamp, used consistently so DB comparisons never mix tz-aware/naive."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Channel(str, Enum):
    whatsapp = "whatsapp"
    sms = "sms"
    email = "email"
    rcs = "rcs"


class Fulfillment(str, Enum):
    dine_in = "dine_in"
    delivery = "delivery"
    takeaway = "takeaway"


class Customer(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    name: str
    email: str = Field(index=True)
    phone: str
    city: str
    signup_at: datetime
    preferred_channel: Channel = Field(default=Channel.whatsapp)

    # Denormalised RFM, kept fresh on order ingest for fast segmentation.
    first_order_at: datetime | None = Field(default=None)
    last_order_at: datetime | None = Field(default=None, index=True)
    order_count: int = Field(default=0, index=True)
    lifetime_value: float = Field(default=0.0)
    favorite_item: str | None = Field(default=None)


class Order(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    customer_id: str = Field(foreign_key="customer.id", index=True)
    amount: float
    placed_at: datetime = Field(index=True)
    fulfillment: Fulfillment = Field(default=Fulfillment.delivery)
    item: str | None = Field(default=None)
    # Set when an order is attributed to a campaign (order placed after a click). See attribution.
    attributed_campaign_id: str | None = Field(default=None, index=True)


class CommStatus(str, Enum):
    queued = "queued"        # in the outbox, not yet dispatched
    sent = "sent"            # handed to the channel service
    delivered = "delivered"
    opened = "opened"
    read = "read"
    clicked = "clicked"
    failed = "failed"        # terminal: dispatch failed after retries
    bounced = "bounced"      # terminal: channel could not deliver


# Positive lifecycle is monotonic; we only ever advance forward. Out-of-order callbacks
# (a late "delivered" after "opened") are ignored by comparing ranks. failed/bounced are
# terminal and handled separately.
STATUS_RANK = {
    CommStatus.queued: 0,
    CommStatus.sent: 1,
    CommStatus.delivered: 2,
    CommStatus.opened: 3,
    CommStatus.read: 4,
    CommStatus.clicked: 5,
}
TERMINAL_FAILURES = {CommStatus.failed, CommStatus.bounced}


class CampaignStatus(str, Enum):
    draft = "draft"          # proposed by agent, awaiting approval
    launched = "launched"    # communications enqueued/dispatching
    completed = "completed"


class Campaign(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    name: str
    goal: str                                    # the marketer's plain-English intent
    segment_spec: str = Field(default="{}")      # JSON of the SegmentSpec used
    messages: str = Field(default="{}")          # JSON {channel: message_template}
    status: CampaignStatus = Field(default=CampaignStatus.draft)
    holdout_percent: float = Field(default=10.0)  # control group held back from sending
    audience_size: int = Field(default=0)
    holdout_size: int = Field(default=0)
    conversions_simulated: bool = Field(default=False)  # guards the demo "fast-forward" step
    created_at: datetime = Field(default_factory=utcnow)
    launched_at: datetime | None = Field(default=None)


class Communication(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    campaign_id: str = Field(foreign_key="campaign.id", index=True)
    customer_id: str = Field(foreign_key="customer.id", index=True)
    channel: Channel
    recipient: str
    message: str
    status: CommStatus = Field(default=CommStatus.queued, index=True)
    status_rank: int = Field(default=0)
    is_holdout: bool = Field(default=False, index=True)  # control group: never dispatched
    attempts: int = Field(default=0)
    last_error: str | None = Field(default=None)
    next_retry_at: datetime | None = Field(default=None)  # backoff gate for the dispatcher
    created_at: datetime = Field(default_factory=utcnow)
    sent_at: datetime | None = Field(default=None)
    delivered_at: datetime | None = Field(default=None)
    opened_at: datetime | None = Field(default=None)
    read_at: datetime | None = Field(default=None)
    clicked_at: datetime | None = Field(default=None)
    failed_at: datetime | None = Field(default=None)


class ReceiptEvent(SQLModel, table=True):
    """Dedup log of channel callbacks. The channel-provided `id` is the idempotency key:
    a duplicate callback hits the primary-key conflict and is ignored."""

    id: str = Field(primary_key=True)            # channel event id (idempotency key)
    communication_id: str = Field(foreign_key="communication.id", index=True)
    event: CommStatus
    occurred_at: datetime
    received_at: datetime = Field(default_factory=utcnow)
