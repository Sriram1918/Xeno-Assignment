"""The AI agent (Google Gemini, free tier).

The agent's intelligence is deliberately *structured*. It never writes SQL or invents audiences in
free text. Given a plain-English goal it returns a typed SegmentSpec (validated JSON) that we run
as a real query, plus per-channel copy. A human approves once, then the deterministic engine takes
over. This is the "AI woven in, not bolted on" stance: the model decides *who* and *what to say*;
the system owns *how it's executed and measured*.
"""

import json

import google.generativeai as genai

from .config import settings
from .funnels import funnel
from .messaging import DEFAULT_TEMPLATES
from .models import Campaign
from .schemas import SegmentSpec
from .segments import preview_segment

MODEL = "gemini-2.0-flash"

SEGMENT_PROMPT = """You are the targeting brain of a QSR marketing CRM for the brand "Taco Town".
Convert the marketer's goal into a JSON object with keys: "spec", "name", "rationale".

"spec" is a SegmentSpec with these OPTIONAL fields (omit those you don't need):
- last_order_days_gte (int): at least N days since last order (more lapsed/inactive)
- last_order_days_lte (int): at most N days since last order (more recent)
- lifetime_orders_gte (int), lifetime_orders_lte (int): lifetime order count bounds
- lifetime_value_gte (float, INR)
- cities (list[str]) from: Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Pune, Kolkata, Gurugram
- preferred_channels (list[str]) from: whatsapp, sms, email, rcs
- never_ordered (bool)
- limit (int)

Guidance:
- "regulars"/"loyal"/"frequent" => lifetime_orders_gte 3 (or higher for "very loyal").
- "lapsed"/"inactive"/"gone quiet"/"win back"/"haven't ordered" => last_order_days_gte ~45,
  and usually last_order_days_lte ~120-180 (recoverable, not ancient).
- "new" => lifetime_orders_lte 1.
- "high value"/"big spenders" => lifetime_value_gte (e.g. 4000).
- Pick sensible numbers when the goal is vague. "name" is a short campaign name. "rationale" is one
  sentence explaining who this targets and why.

Return ONLY the JSON object. Marketer goal: "{goal}" """

COPY_PROMPT = """Write short, warm win-back marketing messages for "Taco Town", a fun, fast-casual
taco/Mexican QSR brand. Use ONLY these placeholders: {{name}}, {{favorite_item}}, {{brand}}.
Include a clear, appealing offer. Tone: friendly and a little playful.
- whatsapp: 1-2 short sentences, may use one emoji.
- rcs: similar to whatsapp.
- sms: very short, plain, no emoji.
- email: 2-3 sentences with a brief sign-off from "Team {{brand}}".

Return ONLY a JSON object with keys "whatsapp", "sms", "email", "rcs".
Campaign goal: "{goal}" """

REPORT_PROMPT = """You are a marketing analyst for "Taco Town". In 3-4 friendly sentences, summarise
this win-back campaign for a busy growth marketer. Lead with the recovered (incremental) revenue and
make clear it was validated against a holdout control group (so it's real lift, not a guess). Mention
the engagement funnel briefly. Be concrete with the numbers; do not invent any.

Campaign: "{name}"
Funnel: {funnel}
Attribution: {attribution}

Return plain text only."""


def _model():
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    genai.configure(api_key=settings.gemini_api_key)
    return genai.GenerativeModel(MODEL)


def _parse_json(text: str) -> dict:
    t = text.strip()
    if t.startswith("```"):  # tolerate accidental code fences
        t = t.strip("`")
        if t.lower().startswith("json"):
            t = t[4:]
    return json.loads(t)


def propose_campaign(session, goal: str) -> dict:
    """Turn a plain-English goal into a reviewable proposal: typed segment + preview + copy."""
    model = _model()

    seg_resp = model.generate_content(
        SEGMENT_PROMPT.format(goal=goal),
        generation_config={"response_mime_type": "application/json", "temperature": 0.2},
    )
    seg_data = _parse_json(seg_resp.text)
    spec = SegmentSpec.model_validate(seg_data.get("spec", seg_data))
    name = seg_data.get("name") or "Win-back campaign"
    rationale = seg_data.get("rationale") or ""

    preview = preview_segment(session, spec)

    copy_resp = model.generate_content(
        COPY_PROMPT.format(goal=goal),
        generation_config={"response_mime_type": "application/json", "temperature": 0.6},
    )
    messages = _parse_json(copy_resp.text)
    messages = {k: v for k, v in messages.items() if k in DEFAULT_TEMPLATES}
    if not messages:
        messages = dict(DEFAULT_TEMPLATES)

    return {
        "goal": goal,
        "name": name,
        "rationale": rationale,
        "segment_spec": spec.model_dump(),
        "segment_preview": preview,
        "messages": messages,
    }


def generate_report(session, campaign: Campaign) -> dict:
    """Plain-English results summary grounded in the real funnel + attribution numbers."""
    from .attribution import attribution_report

    f = funnel(session, campaign.id)
    attr = attribution_report(session, campaign)
    model = _model()
    resp = model.generate_content(
        REPORT_PROMPT.format(name=campaign.name, funnel=json.dumps(f), attribution=json.dumps(attr)),
        generation_config={"temperature": 0.5},
    )
    return {"summary": resp.text.strip(), "funnel": f, "attribution": attr}
