"use client";

import { useEffect, useState } from "react";
import { api, Insights as InsightsData, inr } from "@/lib/api";
import { BarList, Donut, PALETTE } from "@/components/Charts";

const STAGE_COLOR: Record<string, string> = {
  "Active regular": "#FFC72C",
  New: "#22D3EE",
  Occasional: "#7B2D8E",
  "Lapsing regular": "#E4007C",
  "Churned regular": "#5C2D91",
  "Lost / one-time": "#9CA3AF",
  "Never ordered": "#4B5563",
};

export function Insights() {
  const [d, setD] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.insights().then(setD).catch((e) => setError(String(e.message)));
  }, []);

  if (error) return <Card><p className="text-sm text-red-300">{error}</p></Card>;
  if (!d) return <Card><p className="text-sm text-white/50">Loading insights…</p></Card>;

  const lifecycle = d.lifecycle.map((l) => ({
    label: l.stage,
    value: l.count,
    color: STAGE_COLOR[l.stage] || "#888",
  }));
  const atRiskPct = Math.round((d.revenue_at_risk / Math.max(d.gross_revenue, 1)) * 100);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Customers" value={d.total_customers.toLocaleString("en-IN")} />
        <Kpi label="Orders" value={d.total_orders.toLocaleString("en-IN")} />
        <Kpi label="Avg order value" value={inr(d.avg_order_value)} />
        <Kpi label="Revenue at risk" value={inr(d.revenue_at_risk)} highlight />
      </div>

      {/* Lifecycle donut + legend */}
      <Card>
        <Title>Customer lifecycle (RFM)</Title>
        <p className="mt-1 text-sm text-white/60">
          About <b className="text-tb-yellow">{inr(d.revenue_at_risk)}</b> ({atRiskPct}% of revenue)
          sits with lapsing & churned customers — that&apos;s the win-back opportunity.
        </p>
        <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
          <Donut
            data={lifecycle}
            center={
              <>
                <div className="text-2xl font-bold">{d.total_customers.toLocaleString("en-IN")}</div>
                <div className="text-xs text-white/50">customers</div>
              </>
            }
          />
          <div className="flex-1 space-y-1.5">
            {d.lifecycle.map((l) => (
              <div key={l.stage} className="flex items-center gap-2 text-sm">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ background: STAGE_COLOR[l.stage] || "#888" }}
                />
                <span className="flex-1 text-white/75">{l.stage}</span>
                <span className="tabular-nums text-white/85">{l.count}</span>
                <span className="w-20 text-right tabular-nums text-white/45">{inr(l.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Channels + spend */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Card>
          <Title>Preferred channel</Title>
          <div className="mt-3">
            <BarList data={d.channels.map((c) => ({ label: c.channel, value: c.count }))} color="#C8159E" />
          </div>
        </Card>
        <Card>
          <Title>Lifetime spend</Title>
          <div className="mt-3">
            <BarList data={d.spend_buckets.map((s) => ({ label: s.bucket, value: s.count }))} color="#FFC72C" />
          </div>
        </Card>
      </div>

      {/* Cities */}
      <Card>
        <Title>Top cities</Title>
        <div className="mt-3">
          <BarList data={d.top_cities.map((c) => ({ label: c.city, value: c.count }))} color="#7B2D8E" />
        </div>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">{children}</div>;
}
function Title({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display text-lg uppercase tracking-wide">{children}</h3>;
}
function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div className={`mt-1 text-xl font-bold ${highlight ? "text-tb-yellow" : ""}`}>{value}</div>
    </div>
  );
}
