# Xeno Engineering Take-Home — My Understanding

> **Role:** SDE (assignment is identical for SDE & FDE)
> **Due:** 12 PM, June 15, 2026 (~3 days from now, 2026-06-12)
> **Deliverables:** Hosted URL + GitHub repo + 5–6 min narrated walkthrough video

---

## 1. What Xeno Does (context)
Xeno helps consumer brands (D2C / retail) reach shoppers in data-driven ways:
- Organise customer data
- Decide **who** to talk to
- Run **personalised campaigns** across channels: WhatsApp, SMS, Email, RCS

This take-home is a miniature of their actual product.

## 2. The Core Challenge
**Build & deploy an AI-native Mini CRM that helps a brand intelligently reach its shoppers.**

Pick a fictional D2C/retail brand (fashion, coffee chain, beauty). The product helps that brand decide **who to talk to, what to say, and reach them** over messaging channels.

## 3. Minimum Functional Requirements
| # | Capability | Detail |
|---|------------|--------|
| 1 | **Ingest data** | Take in customers + their orders, store them |
| 2 | **Segment shoppers** | Marketer (or AI) carves audiences from data by behaviour + attributes |
| 3 | **Send personalised comms** | Dispatch tailored messages to a chosen audience via a channel service |
| 4 | **Surface performance insights** | Track & present sent / delivered / failed / opened / read / clicked / **order attributed to comm**, at campaign and/or audience level |

> Everything **beyond** these four is *your* call. Deciding what to build **and what NOT to build** is itself being evaluated.

## 4. What "AI-native" Means (must be woven in, not bolted on)
They list 4 example shapes (illustrations, **not** requirements — pick ONE and commit):
1. Classic UI where AI assists at key steps (draft messages, suggest segments)
2. **Chat-first** — marketer describes intent in natural language, product responds
3. AI that helps the marketer **think, decide & act** — surfaces audience, recommends message, picks channel
4. A **true AI agent** — takes a broad goal brainstormed with the marketer and executes the campaign end-to-end

## 5. The Channel Service (CRITICAL — explicit requirement)
**Do NOT integrate a real provider. Stub it yourself as a SEPARATE service** and model the full communication lifecycle:

```
CRM  --send API-->  Stubbed Channel Service  (simulates outcomes, no real delivery)
 ^                          |
 |  <--async callback--     |   delivered / failed / opened / read / clicked ...
 |  (CRM receipt API)       |
CRM updates state + stats of each communication
```

This **two-service, callback-driven async loop is deliberate.** They explicitly want to see how you handle:
- **Volume**
- **Ordering**
- **Retries**
- **Failures**

This is the **system-design heart** of the assignment.

## 6. Scope Guardrails
- ✅ IS: a CRM for **reaching shoppers/consumers** — marketing & engagement
- ❌ IS NOT: sales/support CRM (deals, pipelines, leads, tickets — Salesforce/Attio/Clarify). **Do not build that.**
- Use **realistic, well-simulated data** (no real customers/orders needed)

## 7. How They Evaluate (this should guide EVERY decision)
| Criterion | What they want |
|-----------|----------------|
| Build & deploy | Live hosted product + video. **Baseline, not a differentiator.** |
| **Creativity in scoping** | How sharply you chose WHAT to build. Bold, opinionated choices > shallow everything. |
| **AI-native development** | How you **direct, review, integrate** AI output — your workflow, not whether you used AI |
| Code quality & structure | Clean, readable, organised. They read it and ask questions live. |
| System design & scalability | Your scale **assumptions** + conscious **tradeoffs**. Reasoning > perfect architecture. |
| Thought clarity & communication | How clearly you think/present/explain |

## 8. Walkthrough Video Structure (~5–6 min suggested)
| Section | Time | Cover |
|---------|------|-------|
| Product intro | 0.5 | What you built + why; the problem you chose |
| Functional demo | 1.5 | End-to-end, show it actually working |
| Technical architecture | 1 | Architecture diagram + reasoning per decision |
| Code walkthrough | 1 | Structure + a couple of key parts |
| AI-native workflow | 1 | How AI-native your dev workflow was |

## 9. Ground Rules
- Use AI freely — but **be ready to defend everything you ship** (live questions)
- Make tradeoffs **explicit**: *"I'd do X at scale but did Y for this scope"* is a great answer
- Pick your own stack (no requirement)
- **Originality matters** — understand every line; it's reviewed & discussed live

---

## 10. One-line Summary
> A deployed two-service AI-native marketing CRM: ingest customers/orders → segment via AI → send personalised campaigns through a self-stubbed async channel service with full delivery-lifecycle callbacks → surface campaign performance & order attribution. **Win on a sharp, opinionated scope + a robust async delivery loop + a genuinely AI-native build, all explained crisply.**
