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
