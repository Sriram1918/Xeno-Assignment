# Taco Bell — Architecture & Design Rationale (Project State)

> A complete, file-by-file explanation of what's built, **why**, what we deliberately did **not**
> do, and the **alternatives** considered. Written so every decision can be defended live.
>
> **Brand:** an **unaffiliated engineering demo** themed as **Taco Bell** with fully simulated data
> (a small "unofficial demo" disclaimer is shown in-product). It mirrors the win-back / dormant-
> reactivation results Xeno drives for real QSR clients (Taco Bell, Biryani By Kilo).
>
> **Live:** app → https://xeno-assignment-lyart.vercel.app · CRM →
> https://xeno-assignment-production-8c54.up.railway.app · channel →
> https://surprising-trust-production-b6e7.up.railway.app
>
> **The product:** an **AI-native agentic win-back CRM**. A growth marketer states a goal in plain
> English → an AI agent finds the right lapsed shoppers, drafts personalised per-channel copy, sends
> through a self-built async channel service, and reports back **holdout-validated recovered revenue.**

---

## 0. The one-paragraph "what & why"

The brief is intentionally open and says a working deploy is *table stakes*; you stand out on
**sharp scoping, system-design depth, real AI-native usage, and clear communication**. So instead
of building "ingest + segment + send + insights" all shallowly, we made one **opinionated bet**:
go *deep* on a single high-ROI job — **winning back lapsed regulars** — and engineer the two parts
that actually separate an SDE from the pack: (1) a **robust async channel loop** (the part the brief
explicitly calls out: volume, ordering, retries, failures) and (2) **honest, holdout-validated
attribution** (almost nobody builds this). The AI is woven in as the *targeting + copy + reporting*
brain, returning **structured** output we execute deterministically — not a bolted-on chatbot.

---

## 1. Tech stack & why

| Choice | Why | Alternatives considered / why not |
|--------|-----|-----------------------------------|
| **Python + FastAPI** | Fast to build, async-native (needed for the dispatcher + concurrent sends), great typing via Pydantic, candidate's strength | Node/Express (fine, but Python chosen for speed of building); Django (too heavy for an API-first app) |
| **SQLModel** (SQLAlchemy + Pydantic) | One class is both the DB table and the validation model; less boilerplate | Raw SQLAlchemy (more verbose); Tortoise/Prisma (less standard in Python) |
| **PostgreSQL (Railway)** | Real relational DB, indexed segmentation queries, durable outbox | SQLite (no concurrency story); MongoDB (relational data here — customers↔orders) |
| **DB-backed outbox + in-process worker** | Models the brief's async loop with **zero extra infra**, easy to reason about, durable | Redis/Celery or a broker (better at scale, but operational overhead not worth it for this scope — stated as an explicit tradeoff) |
| **Two separate services (CRM + channel)** | The brief explicitly wants the channel stubbed as a **separate service** with callbacks | Single service faking it internally (loses the real network/callback story) |
| **Google Gemini (free tier), `models/gemini-3.1-flash-lite`** | Free, no card, structured-JSON output ideal for the typed `SegmentSpec`. This key's only models with free quota are 2.5/3.x; 3.1-flash-lite has the best allowance (15 RPM / **500 req/day**, resets daily). | gemini-2.0-flash (0 free quota → 429); gemini-1.5-flash (not on this account → 404); Claude/OpenAI (paid). *Would use Claude in production; the agent is one swappable client.* |
| **Next.js on Vercel** (frontend, **deployed**) | Fastest path to a polished landing + app demo, free hosting; `NEXT_PUBLIC_CRM_URL` baked at build | Server-rendered Jinja/HTMX (less polished for a video-graded submission) |
| **Railway Hobby ($5)** | Always-on, no cold starts, two services + DB in one place | Free tiers that sleep (would risk a dead link when reviewers check in week 2) |

---

## 2. Repository structure

```
Xeno-Assignment/
├── crm/                      # Main CRM service (FastAPI)
│   ├── app/
│   │   ├── main.py           # App, lifespan (DB init + start dispatcher), routers
│   │   ├── config.py         # Env-driven settings
│   │   ├── db.py             # Engine, URL normalisation, session, table creation
│   │   ├── models.py         # All DB tables + enums + state-machine ranks
│   │   ├── schemas.py        # Pydantic I/O models incl. the typed SegmentSpec
│   │   ├── segments.py       # Compile SegmentSpec -> real query + preview
│   │   ├── seed.py           # Realistic cohort-based data generator
│   │   ├── messaging.py      # Per-channel copy personalisation + recipient resolution
│   │   ├── channel_client.py # HTTP client: CRM -> channel /send
│   │   ├── worker.py         # Outbox dispatcher (retries, backoff, dead-letter)
│   │   ├── funnels.py        # Shared funnel computation
│   │   ├── attribution.py    # Holdout-validated attribution + conversion simulation
│   │   ├── agent.py          # Gemini agent: goal -> segment + copy + report
│   │   └── api/
│   │       ├── admin.py      # seed / reset / recreate / stats / dbcheck
│   │       ├── segments.py   # /segments/preview
│   │       ├── campaigns.py  # create / launch / stats / simulate / attribution
│   │       ├── receipts.py   # channel callbacks (idempotent, out-of-order safe)
│   │       ├── agent.py      # /agent/plan, /agent/report, /agent/models
│   │       └── demo.py       # /demo/reset (public — restore pristine demo data)
│   ├── requirements.txt
│   └── Procfile              # uvicorn start command for Railway
├── channel/                  # Stubbed channel service (FastAPI)
│   └── app/main.py           # /send + async outcome simulation + callbacks
├── web/                      # Next.js frontend (Vercel)
│   ├── app/
│   │   ├── page.tsx          # Landing page (brand hero + "Start the demo")
│   │   ├── app/page.tsx      # The product (agent flow + dashboard + reset)
│   │   ├── layout.tsx        # Fonts (Anton/Inter), metadata
│   │   └── globals.css       # Brand gradient background
│   ├── components/Brand.tsx  # Logo + hero image (graceful fallbacks)
│   ├── lib/api.ts            # Typed CRM API client
│   ├── public/               # logo.jpg, hero.jpg (resized), logo-retro.jpg
│   └── tailwind.config.js    # Taco Bell palette
├── README.md  PLAN.md  UNDERSTANDING.md  ARCHITECTURE.md
```

**Why a monorepo with two service folders:** keeps the two deployables together (one repo to review)
while letting Railway build each from its own `Root Directory`. Clear separation matches the brief.

---

## 3. The CRM service — file by file

### `config.py` — runtime configuration
- **`Settings`** (pydantic-settings): reads env vars (`.env` locally, Railway vars in prod).
  Fields: `database_url`, `channel_service_url`, `crm_public_url`, `gemini_api_key`,
  `admin_token`, `environment`.
- **Why:** one typed, validated source of config; no scattered `os.getenv`.
- **Why the `crm_public_url`:** the channel must call *back* into us, so we pass our own public URL
  as the callback target — exactly how real webhooks work.

### `db.py` — database engine & sessions
- **`_normalise(url)`** — strips whitespace and rewrites `postgres://` / `postgresql://` to the
  explicit `postgresql+psycopg://` (psycopg v3) driver.
  - **Why:** Railway's `DATABASE_URL` came with a **trailing newline** (broke the DB name) and hosts
    vary between `postgres://` and `postgresql://`. This made the connection robust to both. *(Real
    bug we hit and fixed — good story.)*
- **`engine`** — created once, `pool_pre_ping=True` so stale connections are detected.
- **`init_db()`** — `SQLModel.metadata.create_all` (creates missing tables on startup).
- **`get_session()`** — FastAPI dependency yielding a session per request.
- **Limitation (known):** `create_all` never *alters* existing tables. After schema changes we use a
  guarded `/admin/recreate` (drop+create) rather than migrations. **At scale → Alembic migrations.**
  Stated explicitly because it bit us once (a new column wasn't added to the live table).

### `models.py` — the data model & state machine
Helpers: **`new_id()`** (uuid hex PKs — non-sequential, safe to expose), **`utcnow()`** (naive UTC so
DB comparisons never mix tz-aware/naive).

Enums: **`Channel`** (whatsapp/sms/email/rcs), **`Fulfillment`** (dine_in/delivery/takeaway),
**`CommStatus`** (queued→sent→delivered→opened→read→clicked, + failed/bounced),
**`CampaignStatus`** (draft→launched→completed).

- **`STATUS_RANK`** — maps the positive lifecycle to monotonically increasing integers.
  **Why:** out-of-order callbacks. We only advance status when an incoming event's rank is *higher*,
  so a late "delivered" after "opened" never regresses state.
- **`TERMINAL_FAILURES`** = {failed, bounced} — terminal states we never move past.

Tables:
- **`Customer`** — identity + `preferred_channel` + **denormalised RFM**: `first_order_at`,
  `last_order_at`, `order_count`, `lifetime_value`, `favorite_item`.
  - **Why denormalise:** segmentation ("regulars who went quiet") becomes a fast, **index-backed**
    query instead of aggregating the orders table every request. `last_order_at` & `order_count`
    are indexed. **Alternative:** compute RFM on the fly (simpler, but slow at scale) or a
    warehouse/materialised view (overkill here). Tradeoff stated.
- **`Order`** — `amount`, `placed_at` (indexed), `fulfillment`, `item`, and
  **`attributed_campaign_id`** (set when an order is credited to a campaign).
  - **Money as `float`:** simplicity for the demo; **at scale → `Decimal`/`NUMERIC`** to avoid
    floating-point rounding. Stated tradeoff.
- **`Campaign`** — `goal` (the NL intent), `segment_spec` (JSON of the spec used), `messages` (JSON
  per-channel copy), `status`, `holdout_percent`, `audience_size`, `holdout_size`,
  `conversions_simulated` (guards the demo "fast-forward" so it can't double-count).
- **`Communication`** — **one row per (campaign, customer)** = the outbox unit. Carries `channel`,
  `recipient`, `message`, `status`+`status_rank`, `is_holdout`, `attempts`, `last_error`,
  `next_retry_at` (backoff gate), and per-stage timestamps (`sent_at`…`clicked_at`, `failed_at`).
  - **Why per-stage timestamps:** lets the funnel count "ever reached delivered/opened/…" accurately
    even with out-of-order events (we backfill the timestamp without regressing status).
- **`ReceiptEvent`** — **dedup log**; PK = the channel-issued `event_id`.
  - **Why:** idempotency. A duplicate callback hits the primary-key conflict and is ignored, so stats
    never double-count. **Alternative:** a unique constraint on (comm_id, event) — but the channel's
    own event id is the most honest idempotency key.

### `schemas.py` — API contracts
- **`SegmentSpec`** ⭐ — the **typed audience contract** the AI must return. Optional RFM bounds
  (`last_order_days_gte/lte`, `lifetime_orders_gte/lte`, `lifetime_value_gte`), attributes (`cities`,
  `preferred_channels`, `never_ordered`), and a safety `limit`.
  - **Why this is the crux of "AI-native, not bolted-on":** the model never writes SQL or free-text
    audiences. It emits a **validated** `SegmentSpec`; we compile that to a query. Safe, auditable,
    and the model's "intelligence" is structured. **Alternative:** let the LLM write SQL
    (powerful but unsafe/unpredictable) or natural-language filters (ambiguous). Rejected.
- **`CustomerPreview` / `SegmentPreview`** — audience size, total LTV, channel breakdown, sample
  customers — so a human can sanity-check the audience before sending.
- **`CampaignCreate`** — name, goal, spec, optional per-channel messages, `holdout_percent` (0–50).
- **`ReceiptIn`** — the channel callback payload; `event_id` is the idempotency key.

### `segments.py` — compile a spec into reality
- **`build_query(spec)`** — translates each spec field into a SQLAlchemy `where`. Recency is
  converted to bounds on `last_order_at` (`now - N days`).
- **`run_segment`** — executes; if `limit` set, **prioritises highest-LTV customers** (spend the send
  budget on the most valuable shoppers).
- **`preview_segment`** — audience size, total LTV, per-channel breakdown, and the top-N sample
  customers. Powers the agent's "here's who I'd target" proposal.
- **Why a compiler module:** single, tested bridge between AI output and the DB; nothing else builds
  audience queries.

### `seed.py` — realistic, story-shaped data
- **`COHORTS`** — weighted cohorts (`loyal_active`, **`lapsing`**, `deep_churn`, `new`, `one_time`,
  `occasional`), each with order-count and "days since last order" ranges.
  - **Why cohorts (not uniform random):** we deliberately **manufacture a win-back audience** — the
    `lapsing` cohort (was regular, quiet 45–110 days) — so the demo has a real, actionable story.
    Random data would have no clear segment to act on.
- **`_make_customer()`** — builds a customer + a plausible order history (per-customer cadence,
  favourite-item bias, realistic amounts), then computes the denormalised RFM fields.
- **`seed_database(n, reset, random_seed)`** — generates everyone, **batched bulk inserts** (commit
  per 1,000 orders) for speed; `random_seed=42` makes it reproducible.
- **`summarize()`** — returns totals **plus the size & LTV of the prime win-back audience** so the
  data story is verifiable (currently: 2,500 customers, ~18k orders, **564 lapsed regulars, ₹18.4L**).
- **Faker `en_IN`** — Indian names/cities/phones to match Xeno's market.

### `messaging.py` — personalisation
- **`DEFAULT_TEMPLATES`** — per-channel fallback copy with the right tone (WhatsApp/RCS short +
  emoji; SMS plain; Email longer with a sign-off).
- **`render_message(template, customer)`** — fills `{name}` (first name), `{favorite_item}`, `{city}`,
  `{brand}`; **never throws** on a bad placeholder (returns the raw template) so a copy typo can't
  break a send.
- **`recipient_for(customer, channel)`** — email address for Email, phone otherwise.

### `channel_client.py` — talking to the channel
- **`dispatch(client, comm)`** — POSTs one communication to the channel `/send` with a `callback_url`
  pointing back at our `/receipts`. Raises on non-2xx so the dispatcher can retry.
- **Why pass `callback_url` in the payload:** the channel shouldn't hardcode our address — the sender
  tells it where to report, like real webhook systems.

### `worker.py` — the outbox dispatcher ⭐ (SDE showpiece)
- **`process_batch()`** — selects up to `BATCH_SIZE` (50) communications that are `queued`,
  **not holdout**, and **due** (`next_retry_at` null or past), oldest first; dispatches the batch
  **concurrently** (`asyncio.gather`); then per result:
  - success → `sent`, `status_rank=1`, `sent_at`, clear error/backoff.
  - failure → increment `attempts`; if `>= MAX_ATTEMPTS` (5) → **dead-letter** (`failed`); else set
    **exponential backoff** `next_retry_at` (2,4,8,16,32,60s cap).
- **`dispatcher_loop(stop_event)`** — runs forever; drains fast when busy (0.2s), idle-polls gently
  (2s) when empty; survives transient errors without dying.
- **Design rationale (the talking points):**
  - **Outbox pattern:** launching a campaign only writes rows in one transaction; this loop is the
    *only* thing that calls the channel, so a crash mid-launch never half-sends — unsent rows stay
    queued and resume.
  - **At-least-once + idempotency:** retries may send twice; correctness comes from the receipt side
    deduping by `event_id`.
  - **Concurrency** for throughput; **backoff + dead-letter** for resilience.
  - **Explicit scale tradeoff:** one in-process worker, claimed with a simple query. At real volume →
    a separate worker process claiming rows with `SELECT … FOR UPDATE SKIP LOCKED`, or a real broker
    (SQS/Redis). Chosen the simple, durable option for this scope.

### `funnels.py` — shared stats
- **`funnel(session, campaign_id)`** — counts audience/holdout/targeted and the funnel
  (queued→sent→delivered→opened→read→clicked→failed) over the **targeted** (non-holdout) set.
- **Why its own module:** both the campaigns API and the AI report need it — avoid duplication.

### `attribution.py` — holdout-validated recovered revenue ⭐ (rare differentiator)
- **`_CONVERSION_PROB`** — post-campaign order probability by deepest engagement (clicked 0.34 …
  delivered 0.06 … **holdout baseline 0.04**).
- **`simulate_conversions(session, campaign)`** — the demo "**fast-forward a week**": generates
  post-campaign orders with an engagement-driven **causal effect** (engaged customers come back
  more), tags targeted conversions to the campaign, updates RFM. **Idempotent** via
  `conversions_simulated`.
- **`attribution_report(session, campaign)`** — the honest measurement:
  ```
  lift            = targeted_rate - holdout_rate
  incremental     = lift * targeted_count
  recovered_value = incremental * avg_order_value
  ```
  Returns both the **gross attributed** (naive) and **recovered** (incremental) numbers.
- **Why a holdout:** it's the defensible answer to *"how do you know the message caused the sale?"* →
  *"I didn't assume — I held back a random control group and measured the lift."* Same method real
  growth teams use. **The attribution code is blind to who was targeted vs held out** — it only
  measures rates, so it can't "cheat."
- **Honesty note for the viva:** the whole dataset is simulated (the brief allows this). We inject a
  *known* causal effect and show the holdout method correctly recovers it. Verified live:
  targeted 11.3% vs holdout 2.0% → ~₹16.5k recovered.
- **Alternatives rejected:** last-click attribution (overclaims, no causality) or
  "order within N days of click = caused" (better, but still assumes causation). Holdout is the gold
  standard.

### `agent.py` — the AI agent (Gemini) ⭐
- **Prompts:** `SEGMENT_PROMPT` (goal → `{spec, name, rationale}` JSON with guidance mapping phrases
  like "lapsed/win back" → recency bounds), `COPY_PROMPT` (per-channel JSON copy with our
  placeholders), `REPORT_PROMPT` (plain-English results grounded in real numbers).
- **`_model()`** — configures Gemini lazily; raises a clear error if the key is missing (surfaces as
  503 in the API, not a crash).
- **`_parse_json()`** — tolerant JSON parse (handles stray code fences).
- **`propose_campaign(session, goal)`** — goal → validated `SegmentSpec` → **live preview** → drafted
  per-channel copy. Returns a reviewable proposal. **Sends nothing** (this is the approval gate).
- **`generate_report(session, campaign)`** — narrates the funnel + attribution in plain English,
  grounded in the actual numbers (told not to invent figures).
- **Why structured output + `response_mime_type=application/json`:** reliable, parseable, validated by
  `SegmentSpec`. The model owns *who* and *what to say*; the deterministic system owns *execution and
  measurement*. That's the "AI woven in, not bolted on" stance.
- **Model:** `models/gemini-3.1-flash-lite`, configurable via the `GEMINI_MODEL` env var. Chosen
  because this account's free quota only covers 2.5/3.x models and 3.1-flash-lite has the highest
  allowance (**500 req/day**, resets daily) — easily enough for reviewers to test repeatedly.
- **Copy is ASCII-only by instruction** to avoid emoji/curly-quote mojibake from the model output.
- **Why Gemini:** free tier, no card, strong JSON mode. **Would use Claude in production** (the agent
  is a single swappable client) — stated tradeoff.

### `main.py` — app wiring
- **`lifespan`** — on startup: register models + `init_db()` (defensive: a cold DB never takes down
  `/health`), then **start the dispatcher** as a background asyncio task; on shutdown: stop & cancel
  it cleanly.
- **CORS** open (fine for this scope; would restrict to the Vercel origin in prod).
- Includes all routers. App `version` is bumped per deploy as a **deploy marker** (we poll
  `/openapi.json` to know when a new build is actually live before testing).

### `api/` — HTTP surface
- **`admin.py`** — `POST /admin/seed` (token), `POST /admin/reset` (token),
  `POST /admin/recreate` (token, drop+create after schema change), `GET /admin/stats`,
  `GET /admin/dbcheck` (diagnostic: scheme/connectivity/table state, **no secrets**). Destructive
  ones require `admin_token`.
- **`segments.py`** — `POST /segments/preview` (validate a spec against live data, sends nothing).
- **`campaigns.py`** — `POST /campaigns` (create **draft**), `POST /campaigns/{id}/launch`
  (materialise the outbox + assign random **holdout**, the approval gate fires here),
  `GET /campaigns` & `/{id}` & `/{id}/stats` (funnel),
  `POST /{id}/simulate-conversions`, `GET /{id}/attribution`.
- **`receipts.py`** — `POST /receipts`:
  - **`_apply_event`** — terminal-failure guard; bounce only valid before delivery; positive events
    **backfill timestamps** + advance status only when rank increases.
  - **`receive`** — inserts the `ReceiptEvent` and **flushes**; an `IntegrityError` (duplicate
    `event_id`) → `duplicate_ignored`. Otherwise applies the transition atomically.
- **`agent.py`** — `POST /agent/plan` (propose), `POST /agent/report/{id}`, `GET /agent/models`
  (diagnostic: which models the key can use); LLM/parse errors surface as clean 502/503, never a
  stack trace.
- **`demo.py`** — `POST /demo/reset` (**public**, no token): clears campaigns/comms/receipts and
  regenerates customers + orders, so a reviewer can restore the pristine demo story from the UI
  after win-back campaigns have moved customers out of the lapsed segment.

---

## 4. The channel service (`channel/app/main.py`) — deliberate chaos

A separate FastAPI app that **delivers nothing** and simulates reality:
- **`/send`** — accepts a send; **~8% of the time returns 503** (transient dispatch failure) to
  exercise the CRM's retry path; otherwise schedules `simulate` as a background task and returns 202.
- **`_build_funnel()`** — probabilistically decides how far a message gets
  (delivered 0.92 → opened 0.62 → read 0.85 → clicked 0.38; else bounced).
- **`simulate(payload)`** — fires each lifecycle event as an **independently-delayed** callback
  (logical `occurred_at` ordered, network delay random → can arrive **out of order**), and ~6% of the
  time **duplicates** an event (same `event_id`).
- **Why inject failures/dupes/reordering:** it makes the CRM's robustness *real and demonstrable*,
  not theoretical. This is precisely the "volume, ordering, retries, failures" the brief asks to see.

---

## 4b. The web frontend (`web/`, Next.js on Vercel)

A small, deliberately-polished Next.js (App Router, TypeScript, Tailwind) app — the presentation
layer that turns the engine into something a marketer (and a reviewer) wants to use.

- **`app/page.tsx` — landing page.** A bold, brand-themed hero (Anton display font, Taco Bell
  purple→magenta gradient, the dramatic taco hero image), a one-line value prop, a **"Start the
  demo"** CTA into `/app`, and three feature cards. First impression = a real product, not a form.
- **`app/app/page.tsx` — the product.** The whole agent journey in one screen:
  1. an **at-risk banner** (live `GET /admin/stats`) so it's never empty — *"564 regulars have gone
     quiet · ₹18.4L at risk"*;
  2. **Step 1** type a goal → `POST /agent/plan`;
  3. **Step 2** the proposal: audience size, value, channel mix, sample customers, **editable**
     AI-drafted copy, holdout %;
  4. **Step 3** approve → `POST /campaigns` + `/launch`, then a **live funnel** that polls
     `/campaigns/{id}/stats` every 2s;
  5. **Step 4** *"fast-forward a week"* → `/simulate-conversions` + `/attribution` + `/agent/report`
     → the **recovered-revenue** reveal.
  Plus a **Dashboard** tab and a **"Reset demo"** button (`POST /demo/reset`).
- **`components/Brand.tsx`** — logo + hero image with graceful fallbacks (a missing image degrades to
  a text wordmark / is hidden, never a broken icon).
- **`lib/api.ts`** — a typed client; base URL from `NEXT_PUBLIC_CRM_URL` (baked at build).
- **Images** are resized at build-prep (8MB hero → ~195KB) so the page stays fast.
- **Why a real landing + vibrant app:** "creativity in scoping" and "thought clarity & communication"
  are explicitly graded. An empty form reads as boring; this makes the depth underneath *land*.

---

## 5. End-to-end flow (the demo)

```
Marketer goal (NL)
   │  POST /agent/plan
   ▼
Gemini → SegmentSpec (typed) ──compile──► live audience preview + AI copy   [no send]
   │  (human reviews & approves — the ONE gate)
   ▼  POST /campaigns  +  POST /campaigns/{id}/launch
Outbox: Communication rows (queued) + random 10% holdout
   │
   ▼  dispatcher_loop (concurrent, retry+backoff)
CRM ──/send──► Channel stub ──async callbacks (delivered/opened/…/bounced)──► /receipts
   │                                            (idempotent + out-of-order safe)
   ▼  state machine advances; funnel fills
POST /campaigns/{id}/simulate-conversions   ("fast-forward a week")
   │
   ▼  GET /campaigns/{id}/attribution
Holdout lift → incremental orders → RECOVERED REVENUE   (+ /agent/report narrates it)
```

---

## 6. What we deliberately did NOT build (and why)

| Not built | Why it's the right cut |
|-----------|------------------------|
| Manual drag-drop segment builder | The agent **is** the segment builder; building both dilutes the bet |
| Auth / multi-user / orgs | Single-marketer persona; auth is undifferentiated plumbing |
| Scheduling, templates library, A/B testing | One-shot agentic campaigns; these add no insight for the grade |
| Multiple use-cases (welcome, cart-abandon…) | Going wide = shallow. One job (win-back), done deeply, wins |
| Real channel integrations | Explicitly out of scope; the **stub is the point** |
| Alembic migrations | Schema still moving fast; `/admin/recreate` is enough for this scope |
| Decimal money, RBAC, rate limiting | Stated scale tradeoffs, not demo-critical |

---

## 7. Known limitations / "at scale I'd…"

- **One in-process worker** → separate worker(s) + `FOR UPDATE SKIP LOCKED` or a broker.
- **`create_all` not migrations** → Alembic.
- **`float` money** → `NUMERIC`/`Decimal`.
- **CORS `*`** → lock to the Vercel origin.
- **Holdout noise** with small audiences → larger holdout or sequential testing; fine at 564.
- **Conversions simulated on demand** (a demo aid) → in reality they arrive over days via real orders.
- **Admin endpoints token-guarded** but simple → proper auth in prod.

---

## 8. Current state checklist

- [x] Two services + Postgres deployed on Railway (always-on), `/health` green
- [x] 2,500 customers / ~18k orders / 564-strong win-back audience (₹18.4L at risk)
- [x] Typed `SegmentSpec` → real query (verified: 564)
- [x] Async engine: outbox, concurrent dispatch, retries+backoff+dead-letter, idempotent +
      out-of-order receipts, state machine (verified end-to-end)
- [x] Holdout-validated attribution → recovered revenue (verified: ~₹16.5k, 11.3% vs 2.0%)
- [x] AI agent live (Gemini `gemini-3.1-flash-lite`): NL goal → typed `SegmentSpec` + copy + report
- [x] Next.js frontend on Vercel — branded landing + vibrant app + reset (live, wired to CRM)
- [x] `POST /demo/reset` so reviewers can restore the pristine demo story
- [ ] Record the 5–6 min walkthrough video (reseed beforehand) and submit
