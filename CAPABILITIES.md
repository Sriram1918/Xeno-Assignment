# Taco Bell Win-Back CRM — Capabilities & Complete Flow

> What the product does, **how** it does it, every functional component, the architecture, the
> data, the API surface, and the use-cases it solves — with diagrams.
>
> **Live:** app → https://xeno-assignment-lyart.vercel.app · CRM API →
> https://xeno-assignment-production-8c54.up.railway.app/docs

---

## 1. What it can do (capabilities at a glance)

| # | Capability | In one line |
|---|------------|-------------|
| 1 | **Ingest & store shoppers + orders** | 2,500 realistic customers and ~18k orders, with denormalised RFM (recency/frequency/monetary) kept fresh. |
| 2 | **Understand a goal in plain English** | An AI agent turns *"win back regulars who went quiet"* into a precise, **typed** audience definition. |
| 3 | **Segment shoppers** | Compiles that typed definition into a real, index-backed SQL query and previews exactly who it hits. |
| 4 | **Draft personalised copy** | AI writes per-channel messages (WhatsApp / SMS / Email / RCS), personalised with name + favourite item. |
| 5 | **Human approval gate** | The marketer reviews/edits the audience + copy and approves once before anything sends. |
| 6 | **Send at volume (async)** | A durable outbox + background dispatcher delivers to a separate channel service, concurrently, with retries. |
| 7 | **Track the full lifecycle** | Delivery receipts (delivered/opened/read/clicked/failed) flow back asynchronously; live funnel updates. |
| 8 | **Survive real-world mess** | Idempotent + out-of-order-safe receipts; retries with backoff; dead-letter; monotonic state machine. |
| 9 | **Prove the revenue (holdout)** | A random control group is held back; the system measures *incremental* lift → **recovered revenue**. |
| 10 | **Narrate results** | The agent writes a plain-English summary grounded in the real funnel + attribution numbers. |
| 11 | **Dashboard** | Lists all campaigns with status + engagement. |
| 12 | **Reset demo** | One click restores the pristine dataset (for repeated reviewer testing). |

---

## 2. System architecture

```
            ┌──────────────────────────────────────────────────────────────┐
            │                     BROWSER (recruiter / marketer)            │
            └───────────────┬──────────────────────────────────────────────┘
                            │  HTTPS
                            ▼
            ┌──────────────────────────────────────────────────────────────┐
            │   WEB  ·  Next.js (Vercel)                                     │
            │   • Landing page  • Agent flow  • Live funnel  • Dashboard     │
            │   • Reset button         (typed client → CRM API)             │
            └───────────────┬──────────────────────────────────────────────┘
                            │  REST (JSON)
                            ▼
   ┌────────────────────────────────────────────────────────────────────────────┐
   │  CRM  ·  FastAPI (Railway)                                                   │
   │                                                                              │
   │   ┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌─────────────┐   │
   │   │ AI Agent    │   │ Segments     │   │ Campaigns     │   │ Attribution │   │
   │   │ (Gemini)    │──▶│ compiler     │──▶│ + Outbox      │   │ + Holdout   │   │
   │   └─────────────┘   └──────────────┘   └──────┬────────┘   └─────────────┘   │
   │                                               │                              │
   │                          ┌────────────────────▼─────────┐                    │
   │                          │ Dispatcher (background task)  │                    │
   │                          │ drains outbox, retries/backoff│                    │
   │                          └───────┬──────────────▲────────┘                   │
   │   ┌──────────────┐               │ POST /send   │ POST /receipts             │
   │   │ Receipts API │◀──────────────┼──────────────┘ (idempotent, ordered)     │
   │   └──────────────┘               │                                          │
   └───────────────┬──────────────────┼──────────────────────────────────────────┘
                   │ SQL              │ HTTP
                   ▼                  ▼
        ┌──────────────────┐   ┌────────────────────────────────────────────┐
        │ PostgreSQL       │   │  CHANNEL STUB  ·  FastAPI (Railway)         │
        │ (Railway)        │   │  • simulates WhatsApp/SMS/Email/RCS         │
        │ customers, orders│   │  • probabilistic delivery funnel           │
        │ campaigns, comms │   │  • async callbacks back to /receipts       │
        │ receipt_events   │   │  • injects failures / dupes / reordering   │
        └──────────────────┘   └────────────────────────────────────────────┘
```

**Three deployables:** the Next.js **web** app (Vercel), the **CRM** API (Railway), the **channel
stub** (Railway), plus **Postgres** (Railway). The CRM ↔ channel talk over HTTP with **async
callbacks** — exactly how real delivery + engagement tracking works.

---

## 3. The complete end-to-end flow (what happens, and how)

```
 (1) GOAL            (2) PLAN              (3) APPROVE          (4) SEND
 marketer types  ─▶  agent → typed     ─▶  human edits +   ─▶  outbox → dispatcher
 a plain-English     SegmentSpec +          approves once       → channel stub
 goal               copy + preview         (the ONE gate)
                                                                     │
 (7) REPORT          (6) ATTRIBUTION        (5) TRACK               ▼ async
 agent narrates  ◀─  holdout lift →     ◀─  receipts update   ◀─  delivered/opened/
 the outcome         recovered revenue      the live funnel       read/clicked/failed
```

### Step 1 — Goal (plain English)
The marketer types e.g. *"Win back our regulars who used to order often but have gone quiet in the
last couple of months."* → frontend calls `POST /agent/plan`.

### Step 2 — Plan (AI → typed audience + copy)  ·  **how:**
1. The agent sends the goal to **Gemini** with a strict prompt and `response_mime_type=json`.
2. Gemini returns a **`SegmentSpec`** (validated JSON) — e.g. `{last_order_days: 60–180,
   lifetime_orders ≥ 3}`. *It interprets "couple of months" → days, "regulars" → order count.*
3. The **segment compiler** turns that spec into a real `WHERE` query over Postgres and returns a
   **preview**: audience size, total value at risk, channel mix, top sample customers.
4. A second Gemini call drafts **per-channel copy** with `{name}`, `{favorite_item}`, `{brand}`.
5. The agent returns the whole **proposal**. *Nothing has been sent.*

> Key idea: the AI's output is **structured and executed deterministically** — it never writes SQL
> or free-text audiences. That's "AI woven in, not bolted on."

### Step 3 — Approve (the single human gate)  ·  **how:**
The marketer can edit any message and set the **holdout %**. On approve, the frontend calls
`POST /campaigns` (creates a **draft**) then `POST /campaigns/{id}/launch`.
At launch the CRM:
- runs the segment to get the customer list,
- randomly tags **~10% as holdout** (control group — they get nothing),
- writes one **`Communication`** row per customer (status `queued`) — *this is the outbox*,
- renders each message + resolves the recipient (email vs phone) by channel,
- all in one DB transaction → a crash mid-launch never half-sends.

### Step 4 — Send (durable outbox → async dispatch)  ·  **how:**
A **background dispatcher** loop runs inside the CRM process:
- selects a batch of `queued`, non-holdout, *due* communications (oldest first),
- dispatches them **concurrently** to the channel stub's `POST /send`,
- on success → marks `sent`; on failure → **retry with exponential backoff**; after 5 tries →
  **dead-letter** (`failed`).

```
 Outbox (Communication rows)        Dispatcher tick
 ┌───────────────────────────┐      ┌───────────────────────────────────┐
 │ id  status   is_holdout   │      │ pick ≤50 (queued, !holdout, due)   │
 │ c1  queued   false        │ ───▶ │ POST /send (concurrent, gather)    │
 │ c2  queued   false        │      │  ok   → sent / sent_at             │
 │ c3  queued   true (held)  │      │  fail → attempts++, backoff,       │
 └───────────────────────────┘      │         dead-letter after 5        │
                                    └───────────────────────────────────┘
```

### Step 5 — Track (async callbacks → state machine)  ·  **how:**
The **channel stub** accepts a send, then simulates a realistic engagement funnel and **calls back
asynchronously** into the CRM's `POST /receipts` for each event — and deliberately injects the
messy parts of reality:

```
 Channel stub                          CRM /receipts (per event)
 ┌──────────────────────────┐          ┌───────────────────────────────────────────┐
 │ ~8% /send → 503 (retry)  │          │ 1. record event by channel event_id (PK)   │
 │ delivered .92            │  ──────▶ │    duplicate id → IGNORED  (idempotent)    │
 │  └ opened .62            │  events  │ 2. advance status ONLY if rank increases   │
 │     └ read .85           │  (async, │    late "delivered" after "opened" → no    │
 │        └ clicked .38     │  jittered│    regress  (out-of-order safe)            │
 │ else bounced             │  → can   │ 3. backfill the event timestamp            │
 │ ~6% duplicate callback   │  reorder)│ → funnel counts stay correct               │
 └──────────────────────────┘          └───────────────────────────────────────────┘
```

The frontend polls `GET /campaigns/{id}/stats` every 2s, so the funnel
(`sent → delivered → opened → read → clicked`, plus `failed`) **fills live**.

State machine per communication (monotonic; failure is terminal):
```
 queued ─▶ sent ─▶ delivered ─▶ opened ─▶ read ─▶ clicked
   │         │          │
   └─────────┴──────────┴────────▶ failed / bounced   (terminal)
```

### Step 6 — Attribution (holdout-validated recovered revenue)  ·  **how:**
The marketer clicks **"Fast-forward a week"** → `POST /campaigns/{id}/simulate-conversions`, then
`GET /campaigns/{id}/attribution`:
1. **Simulate the next week:** each customer may place a new order with a probability driven by how
   far they engaged (clicked 34% … delivered 6% … **holdout baseline 4%**). Targeted conversions are
   tagged to the campaign.
2. **Measure incrementality (the honest part):**
   ```
   lift            = targeted_conversion_rate − holdout_conversion_rate
   incremental     = lift × targeted_count
   recovered_value = incremental × average_order_value
   ```
3. Returns **both** the naive "gross attributed" number *and* the honest **recovered revenue**
   (only the lift caused by the campaign).

```
 Targeted group ──┐                 11.3% convert ┐
                  ├─ same audience  ──────────────┤  lift = 11.3% − 2.0% = 9.3%
 Holdout group  ──┘  (got nothing)   2.0% convert ┘  → recovered revenue (caused, not assumed)
```

### Step 7 — Report (plain-English narrative)  ·  **how:**
`POST /agent/report/{id}` feeds the **real** funnel + attribution numbers to Gemini, which writes a
3–4 sentence summary for a busy marketer (told *not* to invent figures). The recovered-revenue
number is the headline of the UI's results card.

---

## 4. Functional components (what each part does + how)

### Frontend (`web/`, Next.js on Vercel)
- **Landing page** — brand hero + "Start the demo" CTA + feature cards.
- **Agent flow** — goal box → proposal (audience, samples, editable copy, holdout) → live funnel →
  fast-forward → recovered-revenue reveal.
- **Dashboard** — all campaigns with status + clicks.
- **Reset demo** — calls `POST /demo/reset`.
- *How:* a typed API client (`lib/api.ts`) calls the CRM; `NEXT_PUBLIC_CRM_URL` baked at build.

### CRM (`crm/`, FastAPI on Railway)
| Module | What it does | How |
|--------|--------------|-----|
| `models.py` | Entities + state-machine ranks | SQLModel tables; denormalised RFM; `STATUS_RANK` for ordering |
| `schemas.py` | `SegmentSpec` + I/O models | Pydantic — the typed contract the AI must satisfy |
| `segments.py` | Spec → audience | Compiles a `SegmentSpec` into an index-backed query + preview |
| `seed.py` | Realistic data | Weighted **cohorts** that deliberately manufacture a lapsed-regulars audience |
| `messaging.py` | Personalisation | Per-channel templates + `{name}/{favorite_item}/{brand}`; recipient by channel |
| `agent.py` | The AI brain | Gemini: goal→`SegmentSpec`, per-channel copy, results narrative |
| `channel_client.py` | CRM → channel | `httpx` POST to `/send` with a callback URL |
| `worker.py` | **Outbox dispatcher** | Concurrent batch dispatch, retry+backoff, dead-letter; runs as a background task |
| `funnels.py` | Funnel stats | Counts sent/delivered/opened/read/clicked/failed over the targeted set |
| `attribution.py` | **Holdout lift** | Simulates conversions with a causal effect; computes incremental recovered revenue |
| `api/*` | HTTP surface | admin / segments / campaigns / receipts / agent / demo routers |

### Channel stub (`channel/`, FastAPI on Railway)
- `POST /send` — accepts a send, ~8% transient 503 (to exercise retries), else schedules simulation.
- `simulate()` — probabilistic funnel; fires **independently-delayed** callbacks (→ out-of-order),
  ~6% duplicated (→ idempotency). It **delivers nothing** — it models the lifecycle.

### Database (PostgreSQL on Railway)
`customer`, `order`, `campaign`, `communication`, `receipt_event` — see §6.

---

## 5. Use cases this project solves

1. **Win back lapsed regulars** (the headline) — "bring back people who used to order monthly but
   have gone quiet 45–120 days." → agent finds them, messages them, proves the recovered revenue.
2. **Reactivate one-time triers** — "people who tried us once and never came back."
3. **Geo/value targeting** — "high-value lapsed customers in Mumbai & Bengaluru" (cities + LTV).
4. **Channel-aware outreach** — reach each customer on their preferred channel (WhatsApp/SMS/Email/RCS).
5. **Prove marketing ROI honestly** — answer *"did the message cause the sale?"* with a control group.
6. **Performance insight** — per-campaign funnel + channel mix + conversion lift on a dashboard.
7. **Safe AI-assisted operation** — AI proposes, a human approves once, the system executes + measures.

> Deliberately **out of scope** (a senior-judgment cut list): manual segment builders, auth/multi-user,
> scheduling, A/B testing, real channel integrations. One job, done deeply.

---

## 6. Data model (entities)

```
 Customer ──1:N──▶ Order
   id, name, email, phone, city, preferred_channel        id, customer_id, amount, placed_at,
   signup_at                                               fulfillment, item,
   ── denormalised RFM (kept fresh): ──                    attributed_campaign_id  ◀─ set on win-back
   first_order_at, last_order_at, order_count,
   lifetime_value, favorite_item

 Campaign ──1:N──▶ Communication ──1:N──▶ ReceiptEvent
   id, name, goal,            id, campaign_id, customer_id,    id  ◀─ channel event id (idempotency key)
   segment_spec (JSON),       channel, recipient, message,     communication_id, event, occurred_at
   messages (JSON),           status, status_rank, is_holdout,
   status, holdout_percent,   attempts, next_retry_at,
   audience_size,             sent_at…clicked_at, failed_at
   holdout_size,
   conversions_simulated
```

- **Denormalised RFM** on `Customer` → segmentation is a fast indexed query, not a per-request aggregate.
- **`Communication`** is the **outbox unit** + the per-message **state machine**.
- **`ReceiptEvent`** is the **idempotency log** (PK = channel event id → duplicates rejected).

---

## 7. API surface (catalog)

| Method & path | Purpose |
|---------------|---------|
| `POST /agent/plan` | Goal → typed segment + live preview + AI copy (no send) |
| `POST /agent/report/{id}` | Plain-English results narrative (grounded in real numbers) |
| `GET /agent/models` | Diagnostic: which Gemini models the key can use |
| `POST /segments/preview` | Validate a `SegmentSpec` against live data (no send) |
| `POST /campaigns` | Create a **draft** campaign |
| `POST /campaigns/{id}/launch` | Materialise the outbox + assign holdout (the approval action) |
| `GET /campaigns` · `/{id}` · `/{id}/stats` | List / detail / live funnel |
| `POST /campaigns/{id}/simulate-conversions` | "Fast-forward a week" — generate post-campaign orders |
| `GET /campaigns/{id}/attribution` | Holdout lift → incremental → recovered revenue |
| `POST /receipts` | Channel callback ingest (idempotent, out-of-order safe) |
| `POST /demo/reset` | Restore pristine demo data (public) |
| `POST /admin/seed` · `/reset` · `/recreate` | Data admin (token-guarded) |
| `GET /admin/stats` · `/dbcheck` | At-risk stats / DB diagnostic |
| `GET /health` (both services) | Liveness |

---

## 8. How it maps to the brief (the four "at-minimum" asks)

| Brief asks for… | Where it lives |
|-----------------|----------------|
| **Ingest data** (customers + orders) | `seed.py` + `Customer`/`Order` + `/admin/seed`, `/demo/reset` |
| **Segment shoppers** | `SegmentSpec` → `segments.py` (+ AI proposes it) |
| **Send personalised comms via a channel service** | `messaging.py` + `worker.py` + the separate channel stub |
| **Surface performance insights** | `funnels.py` (funnel) + `attribution.py` (recovered revenue) + dashboard |
| **Two-service callback loop** (volume/ordering/retries/failures) | outbox + dispatcher + idempotent/ordered `/receipts` + injected chaos |
| **AI-native** | the agent: NL → typed segment + copy + report, executed deterministically |

---

## 9. The one-sentence summary

> A marketer describes a goal in plain English; an AI agent turns it into a precise audience and
> personalised messages; a durable async pipeline sends them through a realistic channel service and
> tracks every delivery and engagement; and a holdout control group proves the **real revenue** the
> campaign brought back.
