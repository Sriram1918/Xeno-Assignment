"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  Attribution,
  CampaignRow,
  Funnel,
  inr,
  pct,
  Proposal,
} from "@/lib/api";

const EXAMPLES = [
  "Win back our regulars who used to order often but have gone quiet 45–120 days",
  "Reach high-value lapsed customers in Mumbai and Bengaluru",
  "Bring back people who tried us once and never came back",
];

type Phase = "idle" | "proposed" | "launched" | "results";

export default function Page() {
  const [view, setView] = useState<"agent" | "dashboard">("agent");

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-2xl font-bold">
            <span>🌮</span>
            <span>Taco Town</span>
            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand">
              AI Win-Back CRM
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            Describe a goal in plain English. The agent finds the right shoppers, writes the
            messages, sends them, and proves the revenue it brought back.
          </p>
        </div>
        <nav className="flex gap-1 rounded-lg border border-neutral-800 bg-neutral-900/60 p-1 text-sm">
          {(["agent", "dashboard"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 capitalize transition ${
                view === v ? "bg-brand text-black font-medium" : "text-neutral-300 hover:text-white"
              }`}
            >
              {v}
            </button>
          ))}
        </nav>
      </header>

      {view === "agent" ? <AgentFlow /> : <Dashboard />}

      <footer className="mt-12 text-center text-xs text-neutral-600">
        Fictional demo brand · simulated data · mirrors win-back results Xeno drives for QSR clients.
      </footer>
    </div>
  );
}

function AgentFlow() {
  const [goal, setGoal] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [holdout, setHoldout] = useState(10);

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [attribution, setAttribution] = useState<Attribution | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const ask = async () => {
    if (!goal.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const p = await api.plan(goal);
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
      await api.launch(id);
      setCampaignId(id);
      setPhase("launched");
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  };

  // Poll the funnel while a campaign is draining.
  useEffect(() => {
    if (phase !== "launched" || !campaignId) return;
    let active = true;
    const tick = async () => {
      try {
        const f = await api.stats(campaignId);
        if (active) setFunnel(f);
      } catch {
        /* ignore transient */
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
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setSimulating(false);
    }
  };

  const reset = () => {
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
      {/* Goal input */}
      <Card>
        <Label>Your goal</Label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. Win back our regulars who have gone quiet in the last couple of months"
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm outline-none focus:border-brand"
          disabled={phase !== "idle"}
        />
        {phase === "idle" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setGoal(ex)}
                className="rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-400 hover:border-brand hover:text-brand"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          {phase === "idle" ? (
            <Button onClick={ask} disabled={loading || !goal.trim()}>
              {loading ? "Thinking…" : "Ask the agent →"}
            </Button>
          ) : (
            <Button variant="ghost" onClick={reset}>
              ↻ Start over
            </Button>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Proposal */}
      {proposal && phase !== "idle" && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Badge>Step 1 · Agent proposal</Badge>
          </div>
          <h2 className="text-lg font-semibold">{proposal.name}</h2>
          <p className="mt-1 text-sm text-neutral-400">{proposal.rationale}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Audience" value={proposal.segment_preview.audience_size.toLocaleString("en-IN")} />
            <Stat label="Value at risk" value={inr(proposal.segment_preview.total_lifetime_value)} />
            <Stat label="Holdout" value={`${holdout}%`} />
            <Stat
              label="Channels"
              value={Object.keys(proposal.segment_preview.channel_breakdown).length.toString()}
            />
          </div>

          {/* Channel breakdown */}
          <div className="mt-4">
            <Label>Channel mix</Label>
            <div className="mt-1 space-y-1">
              {Object.entries(proposal.segment_preview.channel_breakdown).map(([ch, n]) => (
                <Bar
                  key={ch}
                  label={ch}
                  value={n}
                  total={proposal.segment_preview.audience_size}
                />
              ))}
            </div>
          </div>

          {/* Sample customers */}
          <div className="mt-4">
            <Label>Who we&apos;d reach (top by value)</Label>
            <div className="mt-1 overflow-hidden rounded-lg border border-neutral-800 text-sm">
              <table className="w-full">
                <thead className="bg-neutral-900 text-xs text-neutral-400">
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
                    <tr key={c.id} className="border-t border-neutral-800/70">
                      <td className="p-2">{c.name}</td>
                      <td className="p-2 text-neutral-400">{c.city}</td>
                      <td className="p-2 text-right">{c.order_count}</td>
                      <td className="p-2 text-right">{inr(c.lifetime_value)}</td>
                      <td className="p-2 text-right">{c.last_order_days ?? "—"}</td>
                      <td className="p-2 capitalize text-neutral-400">{c.preferred_channel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Editable copy */}
          <div className="mt-4">
            <Label>AI-drafted messages (edit before sending)</Label>
            <div className="mt-1 grid gap-3 sm:grid-cols-2">
              {Object.entries(messages).map(([ch, msg]) => (
                <div key={ch} className="rounded-lg border border-neutral-800 bg-neutral-950 p-2">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-brand">
                    {ch}
                  </div>
                  <textarea
                    value={msg}
                    onChange={(e) => setMessages({ ...messages, [ch]: e.target.value })}
                    rows={3}
                    className="w-full resize-none bg-transparent text-sm outline-none"
                    disabled={phase !== "proposed"}
                  />
                </div>
              ))}
            </div>
          </div>

          {phase === "proposed" && (
            <div className="mt-4 flex items-center gap-3">
              <label className="text-sm text-neutral-400">
                Holdout %
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={holdout}
                  onChange={(e) => setHoldout(Number(e.target.value))}
                  className="ml-2 w-16 rounded border border-neutral-800 bg-neutral-950 p-1 text-center text-neutral-100"
                />
              </label>
              <Button onClick={approveAndLaunch} disabled={loading}>
                {loading ? "Launching…" : "✓ Approve & launch"}
              </Button>
              <span className="text-xs text-neutral-500">
                A random {holdout}% is held back (control group) to prove real lift.
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Live funnel */}
      {phase !== "idle" && phase !== "proposed" && funnel && (
        <Card>
          <Badge>Step 2 · Sending {drained ? "· complete" : "· live"}</Badge>
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
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={fastForward} disabled={simulating}>
                {simulating ? "Measuring…" : "⏩ Fast-forward a week → measure results"}
              </Button>
              <span className="text-xs text-neutral-500">
                Simulates the following week, then measures incremental revenue vs the holdout.
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Results */}
      {phase === "results" && attribution && (
        <Card highlight>
          <Badge>Step 3 · Proven results</Badge>
          <div className="mt-3 flex flex-col items-center py-4 text-center">
            <div className="text-sm uppercase tracking-wide text-neutral-400">
              Recovered revenue (holdout-validated)
            </div>
            <div className="mt-1 text-5xl font-bold text-brand">
              {inr(attribution.recovered_revenue)}
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              vs {inr(attribution.gross_attributed_revenue)} naive attribution — we only claim true lift
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Targeted conv." value={pct(attribution.targeted_conversion_rate)} />
            <Stat label="Holdout conv." value={pct(attribution.holdout_conversion_rate)} />
            <Stat label="Lift" value={pct(attribution.lift)} highlight />
            <Stat label="Incremental orders" value={attribution.incremental_conversions.toString()} />
          </div>

          {report && (
            <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
              <Label>Agent summary</Label>
              <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-200">{report}</p>
            </div>
          )}

          <div className="mt-4">
            <Button variant="ghost" onClick={reset}>
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

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <Badge>All campaigns</Badge>
        <Button variant="ghost" onClick={load}>
          ↻ Refresh
        </Button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!rows ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No campaigns yet — run one from the Agent tab.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-800 text-sm">
          <table className="w-full">
            <thead className="bg-neutral-900 text-xs text-neutral-400">
              <tr>
                <th className="p-2 text-left">Campaign</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Audience</th>
                <th className="p-2 text-right">Clicked</th>
                <th className="p-2 text-right">Holdout</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-neutral-800/70">
                  <td className="p-2">{c.name}</td>
                  <td className="p-2 capitalize text-neutral-400">{c.status}</td>
                  <td className="p-2 text-right">{c.audience_size}</td>
                  <td className="p-2 text-right">{c.funnel?.clicked ?? "—"}</td>
                  <td className="p-2 text-right">{c.holdout_size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------- small UI primitives ---------- */

function Card({
  children,
  highlight,
}: {
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-neutral-900/50 p-5 ${
        highlight ? "border-brand/50 shadow-[0_0_40px_-15px] shadow-brand/40" : "border-neutral-800"
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
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40 ${
        variant === "solid"
          ? "bg-brand text-black hover:bg-brand-dark hover:text-white"
          : "border border-neutral-700 text-neutral-300 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{children}</div>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300">
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold ${highlight ? "text-brand" : ""}`}>{value}</div>
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
      <div className="w-28 shrink-0 capitalize text-neutral-400">{label}</div>
      <div className="h-4 flex-1 overflow-hidden rounded bg-neutral-800">
        <div
          className={`h-full ${danger ? "bg-red-500/70" : "bg-brand"}`}
          style={{ width: `${w}%` }}
        />
      </div>
      <div className="w-16 shrink-0 text-right tabular-nums text-neutral-300">{value}</div>
    </div>
  );
}
