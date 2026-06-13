# 🎬 Walkthrough Video Script (~5–6 min)

> **Tone:** calm, confident, conversational — like showing a smart friend something you're proud of.
> Don't rush. Let the recovered-revenue number land.
> **Live URL:** https://xeno-assignment-lyart.vercel.app · **Repo:** github.com/Sriram1918/Xeno-Assignment
>
> **Before recording:** reseed to pristine (so the dashboard is clean and the audience is the full 564):
> `POST /admin/recreate?token=tacotown-seed` then `POST /admin/seed?token=tacotown-seed&n=2500`
> (or just tell me "reseed" and I'll do it). Have the live site open, logged-in to nothing, clean tab.

---

## ⏱️ Section 1 — Product intro & the bet (~0:40)

**[SHOW: the live app, clean dashboard]**

> "Hi, I'm Sriram. The brief was open-ended — build an AI-native mini CRM for reaching shoppers.
> Most people will build a bit of everything: ingest, segment, send, dashboards. I made a
> deliberate bet instead: go **deep on one job** that Xeno's own customers care about — **winning
> back lapsed shoppers**. It's the exact use-case behind results like Biryani By Kilo's dormant
> reactivation and Taco Bell's launch campaigns.
>
> So I built **Taco Town** — a fictional QSR — where a marketer just states a goal in plain English,
> and an **AI agent** finds the right lapsed customers, writes the messages, sends them through a
> realistic channel system, and then **proves the revenue it brought back**.
>
> And just as important — here's what I deliberately **did not** build: no manual segment builder,
> no login system, no scheduling, no five-shallow-use-cases. One job, done properly."

*(Beat — that cut list is the senior-judgment signal. Say it with conviction.)*

---

## ⏱️ Section 2 — Functional demo (~1:30)

**[SHOW: type into the goal box]**

> "Let's run it. I'll tell the agent: *'Win back our regulars who used to order often but have gone
> quiet in the last couple of months.'*"

**[SHOW: click "Ask the agent" → proposal appears]**

> "Now — notice what happened. The agent turned that sentence into a **precise, typed audience**:
> regulars means three-plus orders, 'couple of months quiet' became 45-to-120 days. It ran that
> against real data — **564 customers, ₹18 lakh of lifetime value at risk** — and it shows me exactly
> who they are, and **drafts the messages per channel**, personalised with their name and favourite item.
>
> I can edit any of this. I'm the human in the loop — but only **one** approval gate. I'll keep a
> **10% holdout** — a control group we send nothing to, and you'll see why in a second. Approve and launch."

**[SHOW: funnel filling live — sent → delivered → opened → clicked]**

> "Now it's sending — through a **separate channel service** I built that simulates WhatsApp, SMS,
> Email and RCS. Watch the funnel fill in real time as delivery receipts flow back: delivered, opened,
> read, clicked. Some fail and bounce — that's deliberate, real channels are messy.

**[SHOW: click "Fast-forward a week"]**

> "Let's fast-forward a week to see what actually happened to sales."

**[SHOW: recovered revenue number + targeted vs holdout]**

> "Here's the part I'm proud of. The targeted group converted at **~11%**. The holdout — who got
> nothing — converted at **~2%**. That gap is **real, caused lift**. So instead of vanity-claiming all
> the revenue, I report only the **incremental** number: **the recovered revenue this campaign actually
> caused** — measured against a control group. And the agent writes the summary in plain English."

*(Let the big number sit for a second.)*

---

## ⏱️ Section 3 — Technical architecture (~1:00)

**[SHOW: the architecture diagram from README.md / ARCHITECTURE.md]**

> "Architecture. Two deployed services. The **CRM** — FastAPI and Postgres — and a **separate channel
> service**, talking over HTTP with **async callbacks**, exactly like real delivery + engagement tracking.
>
> When a campaign launches, I don't call the channel directly. I write rows to an **outbox** table in
> one transaction. A background **dispatcher** drains that outbox — concurrently for throughput — and
> if the channel fails, it **retries with exponential backoff**, and dead-letters after five tries.
> So a crash mid-campaign never half-sends.
>
> The callbacks are the interesting part: they arrive **out of order** and sometimes **duplicated** —
> again, on purpose. So receipts are **idempotent**, keyed by the channel's event id, and the status is
> a **monotonic state machine** — a late 'delivered' after 'opened' never moves it backwards.
>
> I consciously used a **Postgres-backed outbox instead of Redis or Celery** — less infrastructure for
> this scope. At real scale I'd move to a broker and claim rows with `FOR UPDATE SKIP LOCKED`. That
> kind of explicit tradeoff is everywhere in the repo."

---

## ⏱️ Section 4 — Code walkthrough (~1:00)

**[SHOW: open the repo — point at the folder structure, then 2 files]**

> "The code's organised so each concern has one home. Quick tour of the two parts I'd want you to see.
>
> **One — the segment compiler.** [SHOW `schemas.py` SegmentSpec + `segments.py`] The AI never writes
> SQL. It returns a **validated `SegmentSpec`** — typed JSON — and *this* compiles it into a real,
> index-backed query. That's how the AI stays powerful but safe and auditable.
>
> **Two — the receipt handler.** [SHOW `api/receipts.py`] This is the idempotency + ordering logic:
> insert the event under its id, a duplicate hits the primary-key conflict and is ignored; positive
> events backfill timestamps but only advance status when the rank increases. Small file, but it's
> the heart of the reliability story."

*(If asked live, you can open `worker.py` and `attribution.py` too — both are heavily commented.)*

---

## ⏱️ Section 5 — AI-native workflow (~0:50)

**[SHOW: ARCHITECTURE.md or your prompts/commits]**

> "Finally — how I built this. I worked **AI-native**: I drove an AI coding assistant with tight specs,
> reviewed every change, and made the architectural calls myself — the outbox, the holdout validation,
> the typed-segment contract were my decisions, and I can defend every line.
>
> In the product itself, the AI is **woven in, not bolted on**: it owns *who to target* and *what to
> say* as structured output, while the deterministic system owns *how it's executed and measured*.
>
> One honest note: I used **Gemini's free tier** here — in production I'd use a stronger model like
> Claude, but the design is model-agnostic; it's one swappable client.
>
> That's Taco Town: one sharp bet, a robust async engine, and revenue I can actually prove. Thanks for
> watching."

---

## 🎯 Delivery checklist
- [ ] Reseed to pristine right before recording (clean dashboard, full 564 audience).
- [ ] Do one practice run end-to-end first (know the timing of the funnel ~20s).
- [ ] Keep the recovered-revenue reveal slow — it's the climax.
- [ ] Say the **cut list** out loud in the first 40 seconds.
- [ ] Have the repo open in a second tab for the code walkthrough.
- [ ] ~5–6 min total. If long, trim Section 4, never Section 1's bet or Section 2's holdout moment.

## 🗣️ If they ask in the interview (quick-fire defenses)
- *"How do you know the message caused the sale?"* → "I didn't assume — random holdout control group, I measure lift."
- *"Why an outbox, not a queue?"* → "Durability with zero extra infra for this scope; broker + SKIP LOCKED at scale."
- *"What if a callback is duplicated / out of order?"* → "Idempotent by event id; monotonic state machine; timestamps backfill without regressing."
- *"Why Gemini?"* → "Free tier for the assignment; design is model-agnostic, one client swap to Claude in prod."
- *"Biggest thing you'd change at scale?"* → "Separate worker process + broker; Alembic migrations; Decimal money; lock CORS."
