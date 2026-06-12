"""Compile a typed SegmentSpec into a real, index-backed query over customers.

This is the bridge between the AI's structured output and the database. The agent proposes a
SegmentSpec; we validate it and run it here. No SQL or free text from the model ever touches
the database directly.
"""

from datetime import timedelta

from sqlmodel import Session, select

from .models import Customer, utcnow
from .schemas import CustomerPreview, SegmentPreview, SegmentSpec


def build_query(spec: SegmentSpec):
    now = utcnow()
    stmt = select(Customer)

    # Recency (days since last order) -> bounds on last_order_at.
    if spec.last_order_days_gte is not None:
        stmt = stmt.where(Customer.last_order_at <= now - timedelta(days=spec.last_order_days_gte))
    if spec.last_order_days_lte is not None:
        stmt = stmt.where(Customer.last_order_at >= now - timedelta(days=spec.last_order_days_lte))

    # Frequency.
    if spec.lifetime_orders_gte is not None:
        stmt = stmt.where(Customer.order_count >= spec.lifetime_orders_gte)
    if spec.lifetime_orders_lte is not None:
        stmt = stmt.where(Customer.order_count <= spec.lifetime_orders_lte)

    # Monetary.
    if spec.lifetime_value_gte is not None:
        stmt = stmt.where(Customer.lifetime_value >= spec.lifetime_value_gte)

    # Attributes.
    if spec.cities:
        stmt = stmt.where(Customer.city.in_(spec.cities))
    if spec.preferred_channels:
        stmt = stmt.where(Customer.preferred_channel.in_(spec.preferred_channels))

    if spec.never_ordered is True:
        stmt = stmt.where(Customer.order_count == 0)
    elif spec.never_ordered is False:
        stmt = stmt.where(Customer.order_count > 0)

    return stmt


def _last_order_days(customer: Customer, now) -> int | None:
    if customer.last_order_at is None:
        return None
    return (now - customer.last_order_at).days


def run_segment(session: Session, spec: SegmentSpec) -> list[Customer]:
    customers = session.exec(build_query(spec)).all()
    if spec.limit is not None:
        # Prioritise highest-value customers when capping the audience.
        customers = sorted(customers, key=lambda c: c.lifetime_value, reverse=True)[: spec.limit]
    return customers


def preview_segment(session: Session, spec: SegmentSpec, sample_size: int = 5) -> SegmentPreview:
    now = utcnow()
    customers = run_segment(session, spec)

    channel_breakdown: dict[str, int] = {}
    for c in customers:
        key = c.preferred_channel.value
        channel_breakdown[key] = channel_breakdown.get(key, 0) + 1

    top = sorted(customers, key=lambda c: c.lifetime_value, reverse=True)[:sample_size]
    samples = [
        CustomerPreview(
            id=c.id,
            name=c.name,
            city=c.city,
            order_count=c.order_count,
            lifetime_value=c.lifetime_value,
            last_order_days=_last_order_days(c, now),
            preferred_channel=c.preferred_channel,
            favorite_item=c.favorite_item,
        )
        for c in top
    ]

    return SegmentPreview(
        spec=spec,
        audience_size=len(customers),
        total_lifetime_value=round(sum(c.lifetime_value for c in customers), 2),
        channel_breakdown=channel_breakdown,
        samples=samples,
    )
