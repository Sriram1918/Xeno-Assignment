"""Channel selection, recipient resolution and per-channel message personalisation."""

from .models import Channel, Customer

BRAND = "Taco Bell"

# Sensible per-channel defaults used when the agent (or marketer) doesn't supply copy.
# Channel tone differs: WhatsApp/RCS are short and emoji-friendly, Email is longer.
DEFAULT_TEMPLATES: dict[str, str] = {
    "whatsapp": "Hey {name}! We miss you at {brand} 🌮 Your favourite {favorite_item} is "
                "waiting — here's 20% off your next order. Tap to reorder!",
    "sms": "{name}, we miss you at {brand}! 20% off your next {favorite_item}. Order now.",
    "email": "Hi {name},\n\nIt's been a while since your last {brand} order. Your favourite "
             "{favorite_item} is just a tap away — enjoy 20% off this week.\n\nSee you soon,\n"
             "Team {brand}",
    "rcs": "{name}, craving {favorite_item}? Come back to {brand} for 20% off 🌮",
}


def render_message(template: str, customer: Customer) -> str:
    data = {
        "name": customer.name.split()[0] if customer.name else "there",
        "favorite_item": customer.favorite_item or "your favourite",
        "city": customer.city,
        "brand": BRAND,
    }
    try:
        return template.format(**data)
    except (KeyError, IndexError, ValueError):
        return template  # never let a bad placeholder break a send


def recipient_for(customer: Customer, channel: Channel) -> str:
    return customer.email if channel == Channel.email else customer.phone
