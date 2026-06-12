# Xeno Assignment — Build Plan

> **Role:** SDE · **Deadline:** Jun 15, 12 PM · **Self-imposed submit:** Jun 15, ~9 AM
> **Started planning:** Jun 12, 6:30 PM

## The bet (what makes us stand out)
A deployed **agentic win-back CRM** for a fictional D2C coffee brand: a growth marketer
describes a goal in plain English, and an AI agent finds the lapsed shoppers, drafts
personalised per-channel copy, sends through a self-built async channel service, and reports
back **provably recovered revenue** (validated with a holdout/control group).

We go **deep on one job (win-back), not wide on five.** We publicly name what we did NOT build.

## North-star number: Recovered Revenue (validated)
- Agent holds back a random ~10% of the target audience and sends them nothing (control group).
- After receipts/orders settle, compare buy-rate of messaged vs control.
- The **difference (lift)** × order value = honestly recovered revenue.
- This is the answer to "how do you know the message caused the sale?" → *"I ran a control group."*

## What we deliberately DON'T build (say this on camera)
- Manual segment builder (the agent IS the segment builder)
- Login / multi-user / orgs
- Scheduling, template library, A/B testing
- Multiple use-cases (welcome, cart-abandon, etc.) — one job, done deeply
- Real channel integrations (explicitly out of scope; the stub is the point)

## Decisions (LOCKED)
- **AI shape:** true AI agent with ONE human approval gate before send
- **Backend:** Python / FastAPI — TWO services: `crm` + `channel` (stub)
- **Async loop:** Postgres-backed **outbox** + background worker (no Redis/Celery for this
  scope — explicit tradeoff: less ops surface now, move to a broker at scale)
- **Frontend:** Next.js (chat panel + dashboard) on **Vercel** (free)
- **Backend hosting:** **Railway Hobby ($5/mo)** — two always-on services, delete after eval
- **Database:** **Railway Postgres** (everything in one place)
- **AI:** Anthropic Claude with tool-calling → returns a TYPED segment spec we run as a real query
- **Keep-awake:** `/health` endpoint + free UptimeRobot ping every ~10 min (insurance)
- **Voice input:** SKIPPED for core; optional thin layer only if everything else is rock-solid
- **Validation:** holdout/control group → Recovered Revenue is measured lift, not a guess

## Where we win (priority order)
1. Sharp, opinionated scope + explicit cut list (product judgment)
2. Real async channel engine: queue, idempotent + out-of-order receipts, retries, state machine (SDE flex)
3. Attribution + holdout-validated recovered revenue (rare; proves business value)
4. AI agent: plain English → typed audience → personalised copy → channel pick → report-back
5. Clean-enough code we can proudly show for 1 min and explain any line of
6. Always-on deployment + a tight, casual 6-min video

## Schedule
| When | Focus | Done when |
|------|-------|-----------|
| Jun 12 night | Scope + scaffold + **deploy skeleton live** | Both services live on real URLs, DB connected, data generator started |
| Jun 13 AM–PM | Messaging engine | Campaign flows end-to-end with fake data: queue → channel → async receipts → status, with retries + dedupe |
| Jun 13 eve | AI agent | Plain English → audience → copy → channel → approval → report-back |
| Jun 14 AM | Attribution + holdout + dashboard | Recovered-revenue number + funnel + channel comparison |
| Jun 14 midday | Polish + final deploy + demo seed + write video script | Live, seeded with a real win-back story, reset button, smoke-tested |
| Jun 14 PM/eve (6 hrs) | Shoot video | Recorded per script → upload to Claude for review → tune |
| Jun 15 AM | Buffer + submit | Final smoke test + submit URL + repo + video |

## Live deployment (Railway project: fearless-cooperation / production)
- **CRM service:** https://xeno-assignment-production-8c54.up.railway.app  (root dir `crm`)
- **Channel service:** https://surprising-trust-production-b6e7.up.railway.app  (root dir `channel`)
- **Postgres:** in-project, referenced via `DATABASE_URL`
- Health: `GET /health` on each returns `{status: ok}`

## Video beats (PDF-mandated structure, ~5-6 min, casual tone)
1. Product intro (~0.5) — brand world + the problem + our bold choice & cut list
2. Functional demo (~1.5) — live end-to-end agent run
3. Technical architecture (~1) — diagram + the async loop reasoning
4. Code walkthrough (~1) — structure + the tricky part (idempotent receipts)
5. AI-native workflow (~1) — how we directed/reviewed AI while building

## Verification loop
Candidate shoots video → uploads to Claude → Claude reviews against PDF rules → candidate retunes.
