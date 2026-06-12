# Taco Town — Agentic Win-Back CRM

An AI-native mini CRM that helps a QSR / restaurant brand **win back lapsed shoppers**. A growth
marketer describes a goal in plain English; an AI agent finds the right shoppers, drafts
personalised per-channel copy, sends it through a self-built async channel service, and reports
back **provably recovered revenue** (validated with a holdout/control group).

> "Taco Town" is a fictional demo brand with simulated data. It mirrors the kind of win-back /
> dormant-reactivation results Xeno drives for real QSR clients (e.g. Taco Bell, Biryani By Kilo).

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
