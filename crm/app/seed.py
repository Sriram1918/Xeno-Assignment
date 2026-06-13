"""Realistic QSR data generator for "Taco Bell" (fictional demo brand, simulated data).

We don't just sprinkle random orders — we generate distinct customer *cohorts* so the product
has a genuine win-back story to act on. The headline cohort is "lapsing regulars": shoppers who
used to order frequently and have gone quiet 45-120 days ago. That's exactly who the AI agent
should target, and it mirrors the dormant-reactivation use-case Xeno runs for real QSR clients.
"""

from __future__ import annotations

import random
from datetime import timedelta

from faker import Faker
from sqlmodel import Session, delete, select

from .models import Channel, Customer, Fulfillment, Order, utcnow

fake = Faker("en_IN")

CITIES = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Kolkata", "Gurugram"]
MENU = [
    "Crunchy Taco", "Loaded Nachos", "Burrito Bowl", "Chicken Quesadilla", "Cheesy Fries",
    "Paneer Taco", "Veg Burrito", "Churros", "Nacho Cheese Wrap", "Chipotle Bowl",
]
CHANNELS = [Channel.whatsapp, Channel.sms, Channel.email, Channel.rcs]
CHANNEL_WEIGHTS = [0.5, 0.2, 0.25, 0.05]
FULFILLMENTS = [Fulfillment.delivery, Fulfillment.dine_in, Fulfillment.takeaway]


# cohort -> (weight, order_count_range, days_since_last_order_range)
# "days since last order" is what drives recency; this is how we manufacture lapsed regulars.
COHORTS = {
    "loyal_active":   (0.20, (6, 30), (0, 20)),     # regulars, still ordering
    "lapsing":        (0.16, (4, 16), (45, 110)),   # PRIME win-back: were regular, gone quiet
    "deep_churn":     (0.14, (3, 12), (130, 320)),  # lapsed long ago
    "new":            (0.18, (1, 2),  (0, 25)),      # just joined
    "one_time":       (0.16, (1, 1),  (40, 260)),    # tried once, never returned
    "occasional":     (0.16, (2, 5),  (20, 75)),     # sporadic
}


def _pick_cohort() -> str:
    names = list(COHORTS.keys())
    weights = [COHORTS[n][0] for n in names]
    return random.choices(names, weights=weights, k=1)[0]


def _make_customer() -> tuple[Customer, list[Order]]:
    cohort = _pick_cohort()
    _, (oc_lo, oc_hi), (rec_lo, rec_hi) = COHORTS[cohort]

    order_count = random.randint(oc_lo, oc_hi)
    days_since_last = random.randint(rec_lo, rec_hi)
    now = utcnow()
    last_order_at = now - timedelta(days=days_since_last)

    # Spread the earlier orders behind the last one with a per-customer cadence.
    cadence_days = random.randint(12, 45)
    placed_dates = [last_order_at]
    for i in range(1, order_count):
        jitter = random.randint(-5, 5)
        placed_dates.append(last_order_at - timedelta(days=cadence_days * i + jitter))
    placed_dates.sort()

    signup_at = placed_dates[0] - timedelta(days=random.randint(1, 20))

    fav = random.choice(MENU)
    orders: list[Order] = []
    for d in placed_dates:
        amount = round(random.uniform(160, 520) + random.choice([0, 0, 0, 120, 240]), 2)
        orders.append(
            Order(
                customer_id="",  # filled after customer id is known
                amount=amount,
                placed_at=d,
                fulfillment=random.choices(FULFILLMENTS, weights=[0.55, 0.25, 0.20])[0],
                item=random.choice([fav, fav, random.choice(MENU)]),  # favourite-biased
            )
        )

    name = fake.name()
    slug = "".join(ch for ch in name.lower() if ch.isalnum() or ch == " ").strip().replace(" ", ".")
    customer = Customer(
        name=name,
        email=f"{slug}{random.randint(1, 999)}@example.com",
        phone=f"+91{random.randint(60, 99)}{random.randint(10000000, 99999999)}",
        city=random.choice(CITIES),
        signup_at=signup_at,
        preferred_channel=random.choices(CHANNELS, weights=CHANNEL_WEIGHTS)[0],
        first_order_at=placed_dates[0],
        last_order_at=placed_dates[-1],
        order_count=order_count,
        lifetime_value=round(sum(o.amount for o in orders), 2),
        favorite_item=fav,
    )
    return customer, orders


def seed_database(session: Session, n_customers: int = 2500, reset: bool = True,
                  random_seed: int | None = 42) -> dict:
    """Generate customers + orders. Returns a small summary for verification."""
    if random_seed is not None:
        random.seed(random_seed)
        Faker.seed(random_seed)

    if reset:
        session.exec(delete(Order))
        session.exec(delete(Customer))
        session.commit()

    total_orders = 0
    batch: list = []
    for _ in range(n_customers):
        customer, orders = _make_customer()
        session.add(customer)
        session.flush()  # assigns customer.id
        for o in orders:
            o.customer_id = customer.id
            batch.append(o)
        total_orders += len(orders)

        if len(batch) >= 1000:
            session.add_all(batch)
            session.commit()
            batch = []
    if batch:
        session.add_all(batch)
    session.commit()

    return summarize(session)


def summarize(session: Session) -> dict:
    """Counts + the size of the prime win-back audience, so the data story is verifiable."""
    now = utcnow()
    win_back_cutoff_recent = now - timedelta(days=45)
    win_back_cutoff_old = now - timedelta(days=120)

    customers = session.exec(select(Customer)).all()
    total_customers = len(customers)
    total_orders = sum(c.order_count for c in customers)
    lapsed_regulars = [
        c for c in customers
        if c.order_count >= 3
        and c.last_order_at is not None
        and win_back_cutoff_old <= c.last_order_at <= win_back_cutoff_recent
    ]
    revenue_at_risk = round(sum(c.lifetime_value for c in lapsed_regulars), 2)

    return {
        "total_customers": total_customers,
        "total_orders": total_orders,
        "lapsed_regulars_45_120d": len(lapsed_regulars),
        "lifetime_value_of_lapsed_regulars": revenue_at_risk,
    }
