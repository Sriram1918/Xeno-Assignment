# Taco Town — Agentic Win-Back CRM

An AI-native mini CRM that helps a QSR / restaurant brand **win back lapsed shoppers**. A growth
marketer describes a goal in plain English; an AI agent finds the right shoppers, drafts
personalised per-channel copy, sends it through a self-built async channel service, and reports
back **provably recovered revenue** (validated with a holdout/control group).

> "Taco Town" is a fictional demo brand with simulated data. It mirrors the kind of win-back /
> dormant-reactivation results Xeno drives for real QSR clients (e.g. Taco Bell, Biryani By Kilo).

## 🔗 Live

- **App:** https://xeno-assignment-lyart.vercel.app
- **CRM API:** https://xeno-assignment-production-8c54.up.railway.app ( `/docs` for the OpenAPI UI )
- **Channel service:** https://surprising-trust-production-b6e7.up.railway.app

**Try it:** open the app → type a goal like *"win back our regulars who've gone quiet in the last
couple of months"* → review the agent's audience + copy → **Approve & launch** → watch the funnel
fill → **Fast-forward a week** to see the holdout-validated recovered revenue.

## The bet (what makes this stand out)

The brief is intentionally open and says a working deploy is *table stakes*. So rather than build
everything shallowly, this goes **deep on one high-ROI job — winning back lapsed regulars** — and
invests in the parts that separate an SDE from the pack:

1. **A real async channel loop** — durable **outbox** + concurrent dispatcher with retry/backoff +
   dead-letter; **idempotent, out-of-order-safe** receipt callbacks; a monotonic state machine.
   (The brief explicitly asks to see volume / ordering / retries / failures.)
2. **Holdout-validated attribution** — a random control group proves *incremental* recovered
   revenue, the honest answer to "did the message cause the sale?". Almost nobody builds this.
3. **AI woven in, not bolted on** — the agent returns a **typed, validated `SegmentSpec`** we run as
   a real query (not free-text or SQL). It owns *who* + *what to say*; the system owns execution.

Deliberately **not** built (senior-judgment cut list): manual segment builder, auth/multi-user,
scheduling, A/B testing, multiple use-cases, real channel integrations. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the full design rationale, file-by-file, with alternatives.

> Xeno Engineering take-home (SDE). See [PLAN.md](PLAN.md) and [UNDERSTANDING.md](UNDERSTANDING.md).

## Architecture (two services + DB)

```
 web (Next.js, Vercel)
        │  HTTP
        ▼
 crm  (FastAPI)  --send-->  channel  (FastAPI stub)
        ▲                        │  simulates delivery outcomes
        └──── async callbacks ───┘  (delivered / opened / clicked / failed ...)
        │
        ▼
   Postgres  (outbox + state machine)
```

- **`crm/`** — ingest, AI agent, segments, campaigns, outbox worker, attribution, insights API.
- **`channel/`** — stubbed messaging provider. Receives sends, simulates outcomes, calls back
  asynchronously into the CRM receipt API.

## Run locally
Each service is a standalone FastAPI app.

```bash
# CRM
cd crm && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

# Channel stub
cd channel && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8100
```

Health checks: `GET /health` on each service.

## Deploy
- `crm` and `channel` → Railway (Hobby), one service each, root directory set per folder.
- Postgres → Railway.
- `web` → Vercel.
