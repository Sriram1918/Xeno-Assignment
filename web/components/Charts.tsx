"use client";

export const PALETTE = ["#FFC72C", "#E4007C", "#C8159E", "#7B2D8E", "#5C2D91", "#9CA3AF", "#22D3EE"];

/** SVG donut chart. data: [{label, value, color}] */
export function Donut({
  data,
  size = 190,
  thickness = 28,
  center,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  center?: React.ReactNode;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {data.map((d, i) => {
            const dash = (d.value / total) * circ;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </g>
      </svg>
      {center && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {center}
        </div>
      )}
    </div>
  );
}

/** Horizontal bar list. data: [{label, value}] */
export function BarList({
  data,
  color = "#C8159E",
  fmt,
}: {
  data: { label: string; value: number }[];
  color?: string;
  fmt?: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-sm">
          <div className="w-24 shrink-0 truncate capitalize text-white/60">{d.label}</div>
          <div className="h-3 flex-1 overflow-hidden rounded bg-white/10">
            <div className="h-full rounded" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <div className="w-16 shrink-0 text-right tabular-nums text-white/80">
            {fmt ? fmt(d.value) : d.value}
          </div>
        </div>
      ))}
    </div>
  );
}
