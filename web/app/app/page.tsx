"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Brandmark } from "@/components/Brand";
import { Insights } from "@/components/Insights";
import { Onboarding } from "@/components/Onboarding";
import {
  api,
  Attribution,
  CampaignRow,
  DemoStats,
  Funnel,
  inr,
  Opportunity,
  pct,
  Proposal,
} from "@/lib/api";

export default function AppPage() {
  const [view, setView] = useState<"agent" | "insights" | "dashboard">("agent");
  const [stats, setStats] = useState<DemoStats | null>(null);
  const [resetting, setResetting] = useState(false);
  const [flowKey, setFlowKey] = useState(0);

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.demoStats());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const reset = async () => {
    if (resetting) return;
    if (!confirm("Reset the demo? This rebuilds ~2,500 shoppers and clears all campaigns (~30s).")) return;
    setResetting(true);
    try {
      await api.resetDemo();
      await loadStats();
      setFlowKey((k) => k + 1);
      setView("agent");
    } catch (e) {
      alert("Reset failed: " + (e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-6">
      <Onboarding />
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Brandmark size="sm" />
          <span className="rounded-full bg-tb-magenta/20 px-2.5 py-1 text-xs font-semibold text-tb-yellow">
            Win-Back CRM
          </span>
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex gap-1 rounded-lg border border-white/15 bg-white/5 p-1 text-sm">
            {(["agent", "insights", "dashboard"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 capitalize transition ${
                  view === v ? "bg-tb-yellow font-semibold text-black" : "text-white/70 hover:text-white"
                }`}
              >
                {v}
              </button>
            ))}
          </nav>
          <button
            onClick={reset}
            disabled={resetting}
            title="Restore pristine demo data"
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:text-white disabled:opacity-50"
          >
            {resetting ? "Resetting…" : "↻ Reset demo"}
          </button>
          <Link href="/" className="rounded-lg px-2 py-1.5 text-sm text-white/50 hover:text-white">
            ← Home
          </Link>
        </div>
      </header>

      {/* At-risk banner — fills the space with purpose */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-tb-magenta/30 bg-gradient-to-r from-tb-purple/40 via-tb-magenta/20 to-transparent p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-tb-yellow">
              💤 Customers slipping away
            </div>
            <div className="mt-1 text-lg text-white/85">
              {stats ? (
                <>
                  <b className="text-white">{stats.lapsed_regulars_45_120d.toLocaleString("en-IN")}</b>{" "}
                  regulars have gone quiet ·{" "}
                  <b className="text-white">{inr(stats.lifetime_value_of_lapsed_regulars)}</b> of
                  lifetime value at risk
                </>
              ) : (
                "Loading the customer base…"
              )}
            </div>
          </div>
          <div className="text-right text-xs text-white/50">
            {stats && (
              <>
                {stats.total_customers.toLocaleString("en-IN")} customers ·{" "}
                {stats.total_orders.toLocaleString("en-IN")} orders
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5">
        {/* Kept mounted so the agent's in-progress campaign/funnel survives tab switches */}
        <div className={view === "agent" ? "" : "hidden"}>
          <AgentFlow key={flowKey} onChange={loadStats} />
        </div>
        {view === "insights" && <Insights />}
        {view === "dashboard" && <Dashboard />}
      </div>

      <footer className="mt-12 text-center text-xs text-white/35">
        Unaffiliated engineering demo · simulated data · mirrors win-back results Xeno drives for QSR clients.
      </footer>
    </div>
  );
}

type Phase = "idle" | "proposed" | "launched" | "results";

// Static per-channel copy variants by tone (no AI call). "Standard" uses the agent's draft.
const TONE_TEMPLATES: Record<string, Record<string, string>> = {
  Urgency: {
    whatsapp: "{name}, today only: 30% off your favourite {favorite_item} at {brand}. Order in the next 2 hours!",
    sms: "{name}, 30% off {favorite_item} at {brand} - today only. Order now.",
    email:
      "Hi {name},\n\nToday only: 30% off your favourite {favorite_item} at {brand}. Offer ends at midnight - don't miss it.\n\nTeam {brand}",
    rcs: "Hurry {name}! 30% off {favorite_item} at {brand}, today only. Tap to order.",
  },
  "Loss-aversion": {
    whatsapp:
      "Hi {name}, we've added a FREE {favorite_item} to your {brand} account - but it expires in 48 hours. Claim it before it's gone!",
    sms: "{name}, a FREE {favorite_item} is waiting in your {brand} account. It expires in 48h - don't lose it.",
    email:
      "Hi {name},\n\nBecause you're a valued regular, we've credited a FREE {favorite_item} to your {brand} account. Heads up - it expires in 48 hours, so claim it before it's gone.\n\nTeam {brand}",
    rcs: "{name}, your FREE {favorite_item} at {brand} expires in 48 hours. Tap to claim it now!",
  },
};

function AgentFlow({ onChange }: { onChange: () => void }) {
  const EXAMPLES = [
    "Win back our regulars who used to order often but have gone quiet 45–120 days",
    "Reach high-value lapsed customers in Mumbai and Bengaluru",
    "Bring back people who tried us once and never came back",
  ];

  const [goal, setGoal] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [analyzing, setAnalyzing] = useState(true);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [holdout, setHoldout] = useState(10);
  const [language, setLanguage] = useState("English");
  const [tone, setTone] = useState("Standard");
  const [costRouting, setCostRouting] = useState(false);

  // Tone really rewrites the copy (static variants — no AI call). Standard = the AI's draft.
  const applyTone = (t: string) => {
    setTone(t);
    if (!proposal) return;
    setMessages(t === "Standard" ? proposal.messages : TONE_TEMPLATES[t] ?? proposal.messages);
  };

  useEffect(() => {
    const t = setTimeout(() => setAnalyzing(false), 1300); // brief "analyzing" beat (no API)
    api.opportunities().then((r) => setOpps(r.opportunities)).catch(() => {});
    return () => clearTimeout(t);
  }, []);

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [attribution, setAttribution] = useState<Attribution | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const ask = async (g?: string) => {
    const text = (g ?? goal).trim();
    if (!text) return;
    setGoal(text);
    setLoading(true);
    setError(null);
    try {
      const p = await api.plan(text);
      setProposal(p);
      setMessages(p.messages);
      setPhase("proposed");
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const approveAndLaunch = async () => {
    if (!proposal) return;
    setLoading(true);
    setError(null);
    try {
      const created = await api.createCampaign({
        name: proposal.name,
        goal: proposal.goal,
        segment_spec: proposal.segment_spec,
        messages,
        holdout_percent: holdout,
      });
      const id = created.campaign.id;
      await api.launch(id, costRouting ? "cost" : "preferred");
      setCampaignId(id);
      setPhase("launched");
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (phase !== "launched" || !campaignId) return;
    let active = true;
    const tick = async () => {
      try {
        const f = await api.stats(campaignId);
        if (active) setFunnel(f);
      } catch {
        /* ignore */
      }
    };
    tick();
    const iv = setInterval(tick, 2000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [phase, campaignId]);

  const fastForward = async () => {
    if (!campaignId) return;
    setSimulating(true);
    setError(null);
    try {
      await api.simulate(campaignId);
      const [attr, rep] = await Promise.all([
        api.attribution(campaignId),
        api.report(campaignId).catch(() => null),
      ]);
      setAttribution(attr);
      setReport(rep?.summary || null);
      setPhase("results");
      onChange();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setSimulating(false);
    }
  };

  const restart = () => {
    setGoal("");
    setPhase("idle");
    setProposal(null);
    setMessages({});
    setCampaignId(null);
    setFunnel(null);
    setAttribution(null);
    setReport(null);
    setError(null);
  };

  const drained = funnel && funnel.queued === 0 && funnel.sent > 0;

  return (
    <div className="space-y-5">
      {phase === "idle" && (analyzing || opps.length > 0) && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-tb-yellow">
            {analyzing ? (
              <span className="animate-pulse">🔎 Analyzing 2,500 customers…</span>
            ) : (
              <>
                ✨ The agent analyzed 2,500 customers — top win-back plays
                <span className="font-normal text-white/45">— click one to run it</span>
              </>
            )}
          </div>
          {analyzing ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
              ))}
            </div>
          ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {opps.map((o) => (
              <button
                key={o.key}
                onClick={() => ask(o.goal)}
                disabled={loading}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-tb-magenta/15 to-white/[0.02] p-4 text-left transition hover:border-tb-yellow/50 disabled:opacity-50"
              >
                <div className="font-display text-base uppercase tracking-wide">{o.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-white/60">{o.why}</p>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-[11px] uppercase text-white/40">Predicted recovery</div>
                    <div className="text-lg font-bold text-tb-yellow">
                      {inr(o.predicted_recovered_revenue)}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-white/45">
                    {o.audience_size.toLocaleString("en-IN")} people
                  </div>
                </div>
              </button>
            ))}
          </div>
          )}
        </div>
      )}

      <Card>
        <Label>Step 1 · Tell the agent what you want</Label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. Win back our regulars who have gone quiet in the last couple of months"
          rows={2}
          className="mt-2 w-full resize-none rounded-lg border border-white/15 bg-black/30 p-3 text-sm outline-none focus:border-tb-yellow"
          disabled={phase !== "idle"}
        />
        {phase === "idle" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setGoal(ex)}
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60 hover:border-tb-yellow hover:text-tb-yellow"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3">
          {phase === "idle" ? (
            <Button onClick={() => ask()} disabled={loading || !goal.trim()}>
              {loading ? "Thinking…" : "Ask the agent →"}
            </Button>
          ) : (
            <Button variant="ghost" onClick={restart}>
              ↻ Start over
            </Button>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {proposal && phase !== "idle" && (
        <Card>
          <Badge>Step 2 · Agent proposal</Badge>
          <h2 className="mt-2 font-display text-2xl uppercase tracking-wide">{proposal.name}</h2>
          <p className="mt-1 text-sm text-white/65">{proposal.rationale}</p>

          <div className="mt-3 rounded-lg border border-tb-yellow/30 bg-tb-yellow/5 p-3 text-sm">
            {proposal.strategy && (
              <p className="text-white/85">
                <b className="text-tb-yellow">Agent&apos;s strategy:</b> {proposal.strategy}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-white/70">
              <span>
                <b className="text-white">Offer:</b> {proposal.offer}
              </span>
              <span>
                <b className="text-white">Predicted recovery:</b>{" "}
                <b className="text-tb-yellow">{inr(proposal.prediction.predicted_recovered_revenue)}</b>{" "}
                (~{proposal.prediction.predicted_incremental_orders} extra orders)
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Audience" value={proposal.segment_preview.audience_size.toLocaleString("en-IN")} />
            <Stat label="Value at risk" value={inr(proposal.segment_preview.total_lifetime_value)} />
            <Stat label="Holdout" value={`${holdout}%`} />
            <Stat label="Channels" value={Object.keys(proposal.segment_preview.channel_breakdown).length.toString()} />
          </div>

          {/* Launch setup moved here — right after the proposal so user never has to scroll far */}
          {phase === "proposed" && (
            <div className="mt-5 rounded-2xl border border-tb-yellow/40 bg-tb-yellow/[0.04] p-5">
              <div className="text-sm font-semibold uppercase tracking-wide text-tb-yellow">
                Launch setup — pick your add-ons
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-sm text-white/70">
                  <span className="text-xs uppercase tracking-wide text-white/45">Tone (rewrites copy)</span>
                  <select
                    value={tone}
                    onChange={(e) => applyTone(e.target.value)}
                    className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white outline-none"
                  >
                    {["Standard", "Urgency", "Loss-aversion"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-white/70">
                  <span className="text-xs uppercase tracking-wide text-white/45">Language (preview)</span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white outline-none"
                  >
                    {["English", "Hindi", "Hinglish", "Tamil", "Telugu"].map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-white/70">
                  <span className="text-xs uppercase tracking-wide text-white/45">Holdout %</span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={holdout}
                    onChange={(e) => setHoldout(Number(e.target.value))}
                    className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-center text-white outline-none"
                  />
                </label>
              </div>

              <label className="mt-3 flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={costRouting}
                  onChange={(e) => setCostRouting(e.target.checked)}
                  className="h-4 w-4 accent-tb-yellow"
                />
                <span>
                  <b>Channel-cost routing</b> — send low-value customers via free Email instead of paid WhatsApp
                </span>
              </label>

              {/* Platform capabilities — explained, not just labelled */}
              <div className="mt-4">
                <div className="mb-2 text-xs uppercase tracking-wide text-white/40">Also available on this platform</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { icon: "⏰", title: "Cart-timing", desc: "Nudge a customer the moment they abandon a cart — not hours later. Food cravings expire fast." },
                    { icon: "🌦️", title: "Weather-aware", desc: "Promote cold drinks on a 42°C day; hot fries on a monsoon evening. Hyper-local, zero extra spend." },
                    { icon: "📅", title: "Payday-cycle", desc: "Push premium combos on salary day (1st–5th); value deals on the 25th when wallets are tight." },
                  ].map((s) => (
                    <div key={s.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-white/80">
                        <span>{s.icon}</span> {s.title}
                        <span className="ml-auto rounded-full bg-tb-magenta/15 px-1.5 py-0.5 text-[10px] text-tb-yellow">platform</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/50">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-col items-center gap-2">
                <button
                  onClick={approveAndLaunch}
                  disabled={loading}
                  className="rounded-full bg-tb-yellow px-10 py-4 text-lg font-bold text-black shadow-[0_0_50px_-12px] shadow-tb-yellow/70 transition hover:scale-[1.03] disabled:opacity-50"
                >
                  {loading ? "Launching…" : "✓ Approve & launch campaign"}
                </button>
                <span className="text-xs text-white/50">
                  A random {holdout}% is held back as a control group to prove real lift
                  {costRouting ? " · cost routing on" : ""}.
                </span>
              </div>
            </div>
          )}

          <div className="mt-4">
            <Label>Channel mix</Label>
            <div className="mt-1 space-y-1">
              {Object.entries(proposal.segment_preview.channel_breakdown).map(([ch, n]) => (
                <Bar key={ch} label={ch} value={n} total={proposal.segment_preview.audience_size} />
              ))}
            </div>
          </div>

          <div className="mt-4">
            <Label>Who we&apos;d reach (top by value)</Label>
            <div className="mt-1 overflow-x-auto rounded-lg border border-white/10 text-sm">
              <table className="w-full">
                <thead className="bg-white/5 text-xs text-white/50">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">City</th>
                    <th className="p-2 text-right">Orders</th>
                    <th className="p-2 text-right">LTV</th>
                    <th className="p-2 text-right">Quiet (days)</th>
                    <th className="p-2 text-left">Channel</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.segment_preview.samples.map((c) => (
                    <tr key={c.id} className="border-t border-white/10">
                      <td className="p-2">{c.name}</td>
                      <td className="p-2 text-white/60">{c.city}</td>
                      <td className="p-2 text-right">{c.order_count}</td>
                      <td className="p-2 text-right">{inr(c.lifetime_value)}</td>
                      <td className="p-2 text-right">{c.last_order_days ?? "—"}</td>
                      <td className="p-2 capitalize text-white/60">{c.preferred_channel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4">
            <Label>AI-drafted messages (edit before sending)</Label>
            <div className="mt-1 grid gap-3 sm:grid-cols-2">
              {Object.entries(messages).map(([ch, msg]) => (
                <div key={ch} className="rounded-lg border border-white/10 bg-black/30 p-2">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-tb-yellow">
                    {ch}
                  </div>
                  <textarea
                    value={msg}
                    onChange={(e) => setMessages({ ...messages, [ch]: e.target.value })}
                    rows={3}
                    className="w-full resize-none bg-transparent text-sm text-white/90 outline-none"
                    disabled={phase !== "proposed"}
                  />
                </div>
              ))}
            </div>
          </div>

        </Card>
      )}

      {phase !== "idle" && phase !== "proposed" && funnel && (
        <Card>
          <Badge>Step 3 · Sending {drained ? "· complete" : "· live"}</Badge>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Targeted" value={funnel.targeted.toString()} />
            <Stat label="Holdout (control)" value={funnel.holdout.toString()} />
            <Stat label="Queued" value={funnel.queued.toString()} />
          </div>
          <div className="mt-4 space-y-1">
            {(["sent", "delivered", "opened", "read", "clicked"] as const).map((k) => (
              <Bar key={k} label={k} value={funnel[k]} total={funnel.targeted || 1} />
            ))}
            {funnel.failed > 0 && (
              <Bar label="failed/bounced" value={funnel.failed} total={funnel.targeted || 1} danger />
            )}
          </div>
          {drained && phase === "launched" && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={fastForward} disabled={simulating}>
                {simulating ? "Measuring…" : "⏩ Fast-forward a week → measure results"}
              </Button>
              <span className="text-xs text-white/50">
                Simulates the following week, then measures incremental revenue vs the holdout.
              </span>
            </div>
          )}
        </Card>
      )}

      {phase === "results" && attribution && (
        <Card highlight>
          <Badge>Step 4 · Proven results</Badge>
          <div className="mt-3 flex flex-col items-center py-5 text-center">
            <div className="text-sm uppercase tracking-wide text-white/60">
              Recovered revenue · holdout-validated
            </div>
            <div className="mt-1 font-display text-6xl text-tb-yellow drop-shadow-[0_0_30px_rgba(255,199,44,0.4)]">
              {inr(attribution.recovered_revenue)}
            </div>
            <div className="mt-2 text-xs text-white/50">
              vs {inr(attribution.gross_attributed_revenue)} naive attribution — we only claim true, caused lift
            </div>
            {proposal && (
              <div className="mt-2 rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                Agent predicted{" "}
                <b className="text-white/80">{inr(proposal.prediction.predicted_recovered_revenue)}</b>{" "}
                · actual <b className="text-tb-yellow">{inr(attribution.recovered_revenue)}</b>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Targeted conv." value={pct(attribution.targeted_conversion_rate)} />
            <Stat label="Holdout conv." value={pct(attribution.holdout_conversion_rate)} />
            <Stat label="Lift" value={pct(attribution.lift)} highlight />
            <Stat label="Incremental orders" value={attribution.incremental_conversions.toString()} />
          </div>

          {report && (
            <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3">
              <Label>Agent summary</Label>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/85">{report}</p>
            </div>
          )}

          <div className="mt-5">
            <Button variant="ghost" onClick={restart}>
              ↻ Run another campaign
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Dashboard() {
  const [rows, setRows] = useState<CampaignRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CampaignRow | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.listCampaigns());
    } catch (e) {
      setError(String((e as Error).message));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (selected) {
    return (
      <CampaignDetail
        campaign={selected}
        onBack={() => {
          setSelected(null);
          load();
        }}
      />
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <Badge>All campaigns</Badge>
        <Button variant="ghost" onClick={load}>
          ↻ Refresh
        </Button>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {!rows ? (
        <p className="text-sm text-white/50">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-white/50">No campaigns yet — run one from the Agent tab.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10 text-sm">
          <table className="w-full">
            <thead className="bg-white/5 text-xs text-white/50">
              <tr>
                <th className="p-2 text-left">Campaign</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Audience</th>
                <th className="p-2 text-right">Clicked</th>
                <th className="p-2 text-right">Holdout</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="cursor-pointer border-t border-white/10 transition hover:bg-white/5"
                >
                  <td className="p-2 font-medium">{c.name}</td>
                  <td className="p-2 capitalize text-white/60">{c.status}</td>
                  <td className="p-2 text-right">{c.audience_size}</td>
                  <td className="p-2 text-right">{c.funnel?.clicked ?? "—"}</td>
                  <td className="p-2 text-right">{c.holdout_size}</td>
                  <td className="p-2 text-right text-tb-yellow">View →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function CampaignDetail({ campaign, onBack }: { campaign: CampaignRow; onBack: () => void }) {
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [attr, setAttr] = useState<Attribution | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const f = await api.stats(campaign.id);
        if (active) setFunnel(f);
      } catch {
        /* ignore */
      }
    };
    tick();
    const iv = setInterval(tick, 2500);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [campaign.id]);

  useEffect(() => {
    if (campaign.conversions_simulated) api.attribution(campaign.id).then(setAttr).catch(() => {});
  }, [campaign.id, campaign.conversions_simulated]);

  const fastForward = async () => {
    setSimulating(true);
    try {
      await api.simulate(campaign.id);
      setAttr(await api.attribution(campaign.id));
    } catch {
      /* ignore */
    } finally {
      setSimulating(false);
    }
  };

  const drained = funnel && funnel.queued === 0 && funnel.sent > 0;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-white/60 hover:text-white">
        ← All campaigns
      </button>

      <Card>
        <Badge>{campaign.status === "launched" ? "Live campaign" : "Campaign"}</Badge>
        <h2 className="mt-2 font-display text-2xl uppercase tracking-wide">{campaign.name}</h2>
        <p className="mt-1 text-sm capitalize text-white/60">
          {campaign.status} · {campaign.audience_size} audience · {campaign.holdout_size} holdout
        </p>

        {funnel ? (
          <>
            <div className="mt-4 space-y-1">
              {(["sent", "delivered", "opened", "read", "clicked"] as const).map((k) => (
                <Bar key={k} label={k} value={funnel[k]} total={funnel.targeted || 1} />
              ))}
              {funnel.failed > 0 && (
                <Bar label="failed/bounced" value={funnel.failed} total={funnel.targeted || 1} danger />
              )}
            </div>
            {drained && !attr && (
              <div className="mt-5">
                <Button onClick={fastForward} disabled={simulating}>
                  {simulating ? "Measuring…" : "⏩ Fast-forward a week → measure results"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="mt-4 text-sm text-white/50">Loading funnel…</p>
        )}
      </Card>

      {attr && (
        <Card highlight>
          <Badge>Proven results</Badge>
          <div className="mt-3 flex flex-col items-center py-5 text-center">
            <div className="text-sm uppercase tracking-wide text-white/60">
              Recovered revenue · holdout-validated
            </div>
            <div className="mt-1 font-display text-6xl text-tb-yellow drop-shadow-[0_0_30px_rgba(255,199,44,0.4)]">
              {inr(attr.recovered_revenue)}
            </div>
            <div className="mt-2 text-xs text-white/50">
              vs {inr(attr.gross_attributed_revenue)} naive attribution — we only claim true, caused lift
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Targeted conv." value={pct(attr.targeted_conversion_rate)} />
            <Stat label="Holdout conv." value={pct(attr.holdout_conversion_rate)} />
            <Stat label="Lift" value={pct(attr.lift)} highlight />
            <Stat label="Incremental orders" value={attr.incremental_conversions.toString()} />
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------- UI primitives ---------- */

function Card({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div
      className={`animate-rise rounded-2xl border bg-white/[0.03] p-5 ${
        highlight
          ? "border-tb-yellow/50 shadow-[0_0_50px_-15px] shadow-tb-yellow/50"
          : "border-white/10"
      }`}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "solid",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "solid" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-40 ${
        variant === "solid"
          ? "bg-tb-yellow text-black hover:brightness-110"
          : "border border-white/20 text-white/80 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-wide text-white/45">{children}</div>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-tb-magenta/20 px-2.5 py-1 text-xs font-semibold text-tb-yellow">
      {children}
    </span>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="text-xs text-white/50">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold ${highlight ? "text-tb-yellow" : ""}`}>{value}</div>
    </div>
  );
}

function Bar({
  label,
  value,
  total,
  danger,
}: {
  label: string;
  value: number;
  total: number;
  danger?: boolean;
}) {
  const w = Math.min(100, Math.round((value / total) * 100));
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-28 shrink-0 capitalize text-white/60">{label}</div>
      <div className="h-4 flex-1 overflow-hidden rounded bg-white/10">
        <div
          className={`h-full rounded ${danger ? "bg-red-500/70" : "bg-gradient-to-r from-tb-magenta to-tb-yellow"}`}
          style={{ width: `${w}%` }}
        />
      </div>
      <div className="w-16 shrink-0 text-right tabular-nums text-white/80">{value}</div>
    </div>
  );
}
