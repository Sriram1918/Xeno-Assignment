"""The strategist: forecast a campaign's recovered revenue, and proactively surface the best
opportunities in the customer base.

This is what turns the agent from an order-taker into a thinking partner. It makes a *bold,
defensible prediction* before any send (predicted recovered revenue) and recommends what to do
next — both grounded in the same engagement + conversion model the attribution uses, so the
forecast lines up with the measured result.
"""

from sqlmodel import Session

from .schemas import SegmentSpec
from .segments import run_segment

# Expected channel funnel (matches the channel stub's probabilities) -> "deepest stage reached".
_P_DELIVERED, _P_OPEN, _P_READ, _P_CLICK = 0.92, 0.62, 0.85, 0.38
# Conversion probability by deepest stage (matches attribution._CONVERSION_PROB).
_CONV = {"clicked": 0.34, "read": 0.18, "opened": 0.12, "delivered": 0.06, "none": 0.02}
_BASELINE = 0.04  # holdout baseline conversion


def _expected_targeted_rate() -> float:
    p_delivered = _P_DELIVERED
    p_opened = p_delivered * _P_OPEN
    p_read = p_opened * _P_READ
    p_clicked = p_read * _P_CLICK
    tiers = {
        "clicked": p_clicked,
        "read": p_read - p_clicked,
        "opened": p_opened - p_read,
        "delivered": p_delivered - p_opened,
        "none": 1 - p_delivered,
    }
    return sum(tiers[k] * _CONV[k] for k in tiers)


_EXPECTED_RATE = _expected_targeted_rate()
_EXPECTED_UPLIFT = max(_EXPECTED_RATE - _BASELINE, 0.0)


def forecast(customers, holdout_percent: float = 10.0) -> dict:
    """Predict the recovered revenue for an audience, before sending anything."""
    n = len(customers)
    targeted = int(round(n * (1 - holdout_percent / 100)))
    total_orders = sum(c.order_count for c in customers) or 1
    total_value = sum(c.lifetime_value for c in customers)
    aov = total_value / total_orders
    incremental = targeted * _EXPECTED_UPLIFT
    predicted = incremental * aov
    return {
        "audience_size": n,
        "targeted": targeted,
        "expected_uplift": round(_EXPECTED_UPLIFT, 4),
        "predicted_incremental_orders": round(incremental, 1),
        "avg_order_value": round(aov, 2),
        "predicted_recovered_revenue": round(predicted, 2),
    }


# Candidate plays the strategist scans for. Each is (label, why, offer, goal-prompt, SegmentSpec).
_PLAYS = [
    {
        "key": "lapsing_regulars",
        "title": "Win back lapsing regulars",
        "why": "Loyal customers (3+ orders) who have gone quiet 45–120 days — high intent to return.",
        "offer": "20% off the next order",
        "goal": "Win back our regulars who used to order often but have gone quiet 45 to 120 days",
        "spec": SegmentSpec(last_order_days_gte=45, last_order_days_lte=120, lifetime_orders_gte=3),
    },
    {
        "key": "vip_at_risk",
        "title": "Rescue high-value customers at risk",
        "why": "Big spenders (₹5k+ lifetime) who haven't ordered in 45+ days — worth a premium offer.",
        "offer": "Free add-on + 15% off",
        "goal": "Reach high-value customers who have spent over 5000 and gone quiet for 45+ days",
        "spec": SegmentSpec(last_order_days_gte=45, lifetime_value_gte=5000, lifetime_orders_gte=2),
    },
    {
        "key": "one_timers",
        "title": "Convert one-time triers into repeats",
        "why": "Customers who ordered once and never came back — a nudge can earn a second visit.",
        "offer": "Buy-one-get-one on their next order",
        "goal": "Bring back people who tried us once and never came back",
        "spec": SegmentSpec(last_order_days_gte=40, lifetime_orders_lte=1),
    },
]


def find_opportunities(session: Session, top: int = 3) -> list[dict]:
    """Scan the base for the highest-value plays, each with a forecast. Sorted by predicted revenue."""
    out = []
    for play in _PLAYS:
        customers = run_segment(session, play["spec"])
        if not customers:
            continue
        f = forecast(customers)
        out.append({
            "key": play["key"],
            "title": play["title"],
            "why": play["why"],
            "offer": play["offer"],
            "goal": play["goal"],
            "audience_size": f["audience_size"],
            "value_at_risk": round(sum(c.lifetime_value for c in customers), 2),
            "predicted_recovered_revenue": f["predicted_recovered_revenue"],
        })
    out.sort(key=lambda x: x["predicted_recovered_revenue"], reverse=True)
    return out[:top]
