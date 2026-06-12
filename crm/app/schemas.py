"""Pydantic schemas for API I/O and the typed segment contract.

SegmentSpec is the key one: the AI agent never writes SQL or free text to define an audience —
it must return a SegmentSpec (validated JSON). We then compile that into a real, index-backed
query. This keeps the AI's "intelligence" structured, auditable and safe.
"""

from pydantic import BaseModel, Field

from .models import Channel


class SegmentSpec(BaseModel):
    """A structured audience definition over RFM + attributes."""

    # Recency: days since last order.
    last_order_days_gte: int | None = Field(default=None, description="At least N days since last order (lapsed)")
    last_order_days_lte: int | None = Field(default=None, description="At most N days since last order (recent)")
    # Frequency: lifetime order count.
    lifetime_orders_gte: int | None = None
    lifetime_orders_lte: int | None = None
    # Monetary: lifetime value.
    lifetime_value_gte: float | None = None
    # Attributes.
    cities: list[str] | None = None
    preferred_channels: list[Channel] | None = None
    never_ordered: bool | None = None
    # Safety cap on audience size.
    limit: int | None = Field(default=None, ge=1, le=100000)


class CustomerPreview(BaseModel):
    id: str
    name: str
    city: str
    order_count: int
    lifetime_value: float
    last_order_days: int | None
    preferred_channel: Channel
    favorite_item: str | None


class SegmentPreview(BaseModel):
    spec: SegmentSpec
    audience_size: int
    total_lifetime_value: float
    channel_breakdown: dict[str, int]
    samples: list[CustomerPreview]


class CampaignCreate(BaseModel):
    name: str
    goal: str
    segment_spec: SegmentSpec
    messages: dict[str, str] | None = None  # {channel: template}; falls back to defaults
    holdout_percent: float = Field(default=10.0, ge=0, le=50)


from datetime import datetime  # noqa: E402

from .models import CommStatus  # noqa: E402


class ReceiptIn(BaseModel):
    """Callback payload from the channel service. `event_id` is the idempotency key."""

    event_id: str
    communication_id: str
    event: CommStatus
    occurred_at: datetime
