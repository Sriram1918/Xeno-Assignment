// Thin typed client for the Taco Town CRM API.
const BASE = (process.env.NEXT_PUBLIC_CRM_URL || "http://localhost:8000").replace(/\/$/, "");

export interface CustomerPreview {
  id: string;
  name: string;
  city: string;
  order_count: number;
  lifetime_value: number;
  last_order_days: number | null;
  preferred_channel: string;
  favorite_item: string | null;
}

export interface SegmentPreview {
  spec: Record<string, unknown>;
  audience_size: number;
  total_lifetime_value: number;
  channel_breakdown: Record<string, number>;
  samples: CustomerPreview[];
}

export interface Prediction {
  audience_size: number;
  targeted: number;
  expected_uplift: number;
  predicted_incremental_orders: number;
  avg_order_value: number;
  predicted_recovered_revenue: number;
}

export interface Proposal {
  goal: string;
  name: string;
  rationale: string;
  offer: string;
  strategy: string;
  segment_spec: Record<string, unknown>;
  segment_preview: SegmentPreview;
  prediction: Prediction;
  messages: Record<string, string>;
}

export interface Opportunity {
  key: string;
  title: string;
  why: string;
  offer: string;
  goal: string;
  audience_size: number;
  value_at_risk: number;
  predicted_recovered_revenue: number;
}

export interface Insights {
  total_customers: number;
  total_orders: number;
  gross_revenue: number;
  avg_order_value: number;
  revenue_at_risk: number;
  lifecycle: { stage: string; count: number; value: number }[];
  channels: { channel: string; count: number }[];
  spend_buckets: { bucket: string; count: number }[];
  top_cities: { city: string; count: number }[];
}

export interface Funnel {
  audience: number;
  holdout: number;
  targeted: number;
  queued: number;
  sent: number;
  delivered: number;
  opened: number;
  read: number;
  clicked: number;
  failed: number;
}

export interface Attribution {
  targeted: number;
  holdout: number;
  targeted_conversions: number;
  holdout_conversions: number;
  targeted_conversion_rate: number;
  holdout_conversion_rate: number;
  lift: number;
  incremental_conversions: number;
  avg_order_value: number;
  gross_attributed_revenue: number;
  recovered_revenue: number;
}

export interface CampaignRow {
  id: string;
  name: string;
  goal: string;
  status: string;
  audience_size: number;
  holdout_size: number;
  conversions_simulated: boolean;
  created_at: string;
  funnel: Funnel | null;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      detail = (await res.json()).detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json();
}

export const api = {
  plan: (goal: string) =>
    req<Proposal>("/agent/plan", { method: "POST", body: JSON.stringify({ goal }) }),

  createCampaign: (p: {
    name: string;
    goal: string;
    segment_spec: Record<string, unknown>;
    messages: Record<string, string>;
    holdout_percent: number;
  }) => req<{ campaign: CampaignRow; audience_size: number }>("/campaigns", {
    method: "POST",
    body: JSON.stringify(p),
  }),

  launch: (id: string, channelStrategy: "preferred" | "cost" = "preferred") =>
    req<{ status: string; campaign_id: string; audience_size: number; targeted: number; holdout: number }>(
      `/campaigns/${id}/launch?channel_strategy=${channelStrategy}`,
      { method: "POST" },
    ),

  stats: (id: string) => req<Funnel>(`/campaigns/${id}/stats`),

  simulate: (id: string) =>
    req<{ status: string; new_orders?: number; gross_attributed_revenue?: number }>(
      `/campaigns/${id}/simulate-conversions`,
      { method: "POST" },
    ),

  attribution: (id: string) => req<Attribution>(`/campaigns/${id}/attribution`),

  report: (id: string) =>
    req<{ summary: string; funnel: Funnel; attribution: Attribution }>(`/agent/report/${id}`, {
      method: "POST",
    }),

  listCampaigns: () => req<CampaignRow[]>("/campaigns"),

  demoStats: () => req<DemoStats>("/admin/stats"),

  resetDemo: () => req<DemoStats & { status: string }>("/demo/reset", { method: "POST" }),

  insights: () => req<Insights>("/insights"),

  opportunities: () => req<{ opportunities: Opportunity[] }>("/strategy/opportunities"),
};

export interface DemoStats {
  total_customers: number;
  total_orders: number;
  lapsed_regulars_45_120d: number;
  lifetime_value_of_lapsed_regulars: number;
}

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
