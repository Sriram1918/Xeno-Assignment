"""HTTP client the CRM uses to hand a communication to the stubbed channel service."""

import httpx

from .config import settings
from .models import Communication


async def dispatch(client: httpx.AsyncClient, comm: Communication) -> None:
    """POST one communication to the channel /send API. Raises on non-2xx so the
    dispatcher can apply retry/backoff."""
    payload = {
        "communication_id": comm.id,
        "channel": comm.channel.value,
        "recipient": comm.recipient,
        "message": comm.message,
        "callback_url": settings.crm_public_url.rstrip("/") + "/receipts",
    }
    resp = await client.post(
        settings.channel_service_url.rstrip("/") + "/send", json=payload, timeout=10.0
    )
    resp.raise_for_status()
