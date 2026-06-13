"""Customer-base analytics — turns the raw data into a picture of what's happening.

This powers the Insights dashboard (charts) and feeds the strategist. It's deterministic
aggregation over the denormalised RFM fields, so it's fast and needs no LLM.
"""

from sqlmodel import Session, select

from .models import Customer, Order, utcnow


def _lifecycle(order_count: int, days: int | None) -> str:
    """Classify a customer by recency + frequency (RFM) into a lifecycle stage."""
    if order_count <= 0 or days is None:
        return "Never ordered"
    if order_count <= 2 and days <= 30:
        return "New"
    if order_count >= 3 and days <= 44:
        return "Active regular"
    if order_count >= 3 and days <= 120:
        return "Lapsing regular"      # the prime win-back audience
    if order_count >= 3:
        return "Churned regular"
    if order_count <= 2 and days > 120:
        return "Lost / one-time"
    return "Occasional"


# Display order for the lifecycle chart.
LIFECYCLE_ORDER = [
    "Active regular",
    "New",
    "Occasional",
    "Lapsing regular",
    "Churned regular",
    "Lost / one-time",
    "Never ordered",
]


def compute_insights(session: Session) -> dict:
    now = utcnow()
    customers = session.exec(select(Customer)).all()
    total_orders = session.exec(select(Order)).all()
    n_orders = len(total_orders)
    gross_revenue = round(sum(o.amount for o in total_orders), 2)
    aov = round(gross_revenue / n_orders, 2) if n_orders else 0.0

    lifecycle_count: dict[str, int] = {}
    lifecycle_value: dict[str, float] = {}
    channel_count: dict[str, int] = {}
    city_count: dict[str, int] = {}
    spend_buckets = {"₹0–1k": 0, "₹1–3k": 0, "₹3–5k": 0, "₹5k+": 0}

    for c in customers:
        days = (now - c.last_order_at).days if c.last_order_at else None
        stage = _lifecycle(c.order_count, days)
        lifecycle_count[stage] = lifecycle_count.get(stage, 0) + 1
        lifecycle_value[stage] = round(lifecycle_value.get(stage, 0.0) + c.lifetime_value, 2)

        channel_count[c.preferred_channel.value] = channel_count.get(c.preferred_channel.value, 0) + 1
        city_count[c.city] = city_count.get(c.city, 0) + 1

        v = c.lifetime_value
        if v < 1000:
            spend_buckets["₹0–1k"] += 1
        elif v < 3000:
            spend_buckets["₹1–3k"] += 1
        elif v < 5000:
            spend_buckets["₹3–5k"] += 1
        else:
            spend_buckets["₹5k+"] += 1

    lifecycle = [
        {"stage": s, "count": lifecycle_count[s], "value": lifecycle_value.get(s, 0.0)}
        for s in LIFECYCLE_ORDER
        if s in lifecycle_count
    ]
    revenue_at_risk = round(
        lifecycle_value.get("Lapsing regular", 0.0) + lifecycle_value.get("Churned regular", 0.0), 2
    )
    top_cities = sorted(
        ({"city": k, "count": v} for k, v in city_count.items()), key=lambda x: x["count"], reverse=True
    )[:8]

    return {
        "total_customers": len(customers),
        "total_orders": n_orders,
        "gross_revenue": gross_revenue,
        "avg_order_value": aov,
        "revenue_at_risk": revenue_at_risk,
        "lifecycle": lifecycle,
        "channels": [{"channel": k, "count": v} for k, v in channel_count.items()],
        "spend_buckets": [{"bucket": k, "count": v} for k, v in spend_buckets.items()],
        "top_cities": top_cities,
    }
