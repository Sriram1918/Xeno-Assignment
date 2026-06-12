"""Holdout-validated attribution — the honest answer to "did the campaign cause sales?"

We never assume that an order following a message was *caused* by it. Instead we hold back a
random control group (sent nothing) and compare conversion rates:

    lift            = targeted_conversion_rate - holdout_conversion_rate
    incremental     = lift * targeted_count          (orders we wouldn't have gotten anyway)
    recovered_value = incremental * avg_order_value

That `recovered_value` is the only revenue we claim. It's the same incrementality method real
growth teams use, and it's defensible under questioning.

Because the whole dataset is simulated (as the brief allows), `simulate_conversions` injects a
*real causal effect* — engaged customers come back more often than the control — and the
attribution above then correctly recovers it. The attribution code itself is blind to who was
targeted vs held out; it only measures rates.
"""

import random

from sqlmodel import Session, select

from .models import Campaign, Communication, Customer, Order, utcnow

# Conversion probability by deepest engagement reached. The gap between these and the holdout
# baseline is the causal lift the holdout method will recover.
_CONVERSION_PROB = {
    "clicked": 0.34,   # clicked the offer -> hot lead
    "read": 0.18,
    "opened": 0.12,
    "delivered": 0.06,
    "none": 0.02,      # targeted but never delivered
    "holdout": 0.04,   # control group baseline (no message)
}


def _engagement_level(comm: Communication) -> str:
    if comm.is_holdout:
        return "holdout"
    if comm.clicked_at:
        return "clicked"
    if comm.read_at:
        return "read"
    if comm.opened_at:
        return "opened"
    if comm.delivered_at:
        return "delivered"
    return "none"


def simulate_conversions(session: Session, campaign: Campaign) -> dict:
    """'Fast-forward a week': generate post-campaign orders with a realistic, engagement-driven
    causal effect. Idempotent per campaign via the conversions_simulated guard."""
    if campaign.conversions_simulated:
        return {"status": "already_simulated"}

    comms = session.exec(
        select(Communication).where(Communication.campaign_id == campaign.id)
    ).all()
    now = utcnow()
    new_orders = 0
    attributed_revenue = 0.0

    for comm in comms:
        level = _engagement_level(comm)
        if random.random() >= _CONVERSION_PROB[level]:
            continue
        customer = session.get(Customer, comm.customer_id)
        if customer is None:
            continue
        amount = round(random.uniform(180, 560), 2)
        session.add(
            Order(
                customer_id=customer.id,
                amount=amount,
                placed_at=now,
                item=customer.favorite_item,
                # Only targeted conversions are tagged to the campaign; holdout orders are organic.
                attributed_campaign_id=None if comm.is_holdout else campaign.id,
            )
        )
        # Keep denormalised RFM fresh.
        customer.order_count += 1
        customer.last_order_at = now
        customer.lifetime_value = round(customer.lifetime_value + amount, 2)
        session.add(customer)
        new_orders += 1
        if not comm.is_holdout:
            attributed_revenue += amount

    campaign.conversions_simulated = True
    session.add(campaign)
    session.commit()
    return {"status": "simulated", "new_orders": new_orders,
            "gross_attributed_revenue": round(attributed_revenue, 2)}


def attribution_report(session: Session, campaign: Campaign) -> dict:
    comms = session.exec(
        select(Communication).where(Communication.campaign_id == campaign.id)
    ).all()
    targeted_ids = [c.customer_id for c in comms if not c.is_holdout]
    holdout_ids = [c.customer_id for c in comms if c.is_holdout]

    launched_at = campaign.launched_at or campaign.created_at
    # Pull every post-launch order for this campaign's customers in one query.
    all_ids = targeted_ids + holdout_ids
    post_orders = session.exec(
        select(Order).where(
            Order.customer_id.in_(all_ids),
            Order.placed_at >= launched_at,
        )
    ).all() if all_ids else []

    converters: dict[str, float] = {}   # customer_id -> total post-launch spend
    for o in post_orders:
        converters[o.customer_id] = converters.get(o.customer_id, 0.0) + o.amount

    targeted_n = len(targeted_ids)
    holdout_n = len(holdout_ids)
    targeted_conv = sum(1 for cid in targeted_ids if cid in converters)
    holdout_conv = sum(1 for cid in holdout_ids if cid in converters)

    targeted_rate = targeted_conv / targeted_n if targeted_n else 0.0
    holdout_rate = holdout_conv / holdout_n if holdout_n else 0.0
    lift = targeted_rate - holdout_rate

    incremental_conversions = max(lift, 0.0) * targeted_n
    targeted_revenue = sum(v for cid, v in converters.items() if cid in set(targeted_ids))
    avg_order_value = (targeted_revenue / targeted_conv) if targeted_conv else 0.0
    recovered_revenue = incremental_conversions * avg_order_value

    return {
        "targeted": targeted_n,
        "holdout": holdout_n,
        "targeted_conversions": targeted_conv,
        "holdout_conversions": holdout_conv,
        "targeted_conversion_rate": round(targeted_rate, 4),
        "holdout_conversion_rate": round(holdout_rate, 4),
        "lift": round(lift, 4),
        "incremental_conversions": round(incremental_conversions, 1),
        "avg_order_value": round(avg_order_value, 2),
        "gross_attributed_revenue": round(targeted_revenue, 2),
        "recovered_revenue": round(recovered_revenue, 2),
    }
