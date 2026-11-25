"use client";

/**
 * Chart wrappers with the UniOS look: hairline grid, mono tick labels,
 * a single accent hue, no legends unless there's more than one series.
 */
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReactNode } from "react";

const tick = { fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--faint)" };

function Tip({ active, payload, label, format }: { active?: boolean; payload?: { value: number; name?: string }[]; label?: string; format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[3px] border border-line bg-surface px-2.5 py-1.5 text-xs shadow-sm">
      <div className="num text-[10px] text-faint">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="num text-ink">
          {format(p.value)}
        </div>
      ))}
    </div>
  );
}

export function Bars<T extends Record<string, unknown>>({
  data,
  x,
  y,
  height = 160,
  format = (v) => String(v),
  colors,
  highlightIndex,
  yTicks = true,
}: {
  data: T[];
  x: keyof T & string;
  y: keyof T & string;
  height?: number;
  format?: (v: number) => string;
  colors?: string[];
  highlightIndex?: number;
  yTicks?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: yTicks ? -12 : -40, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey={x as string} tick={tick} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={yTicks ? tick : false} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => format(Number(v))} allowDecimals={false} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<Tip format={format} />} />
        <Bar dataKey={y as string} radius={[2, 2, 0, 0]} maxBarSize={28} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors?.[i] ?? (highlightIndex === i ? "var(--accent-ink)" : "var(--accent)")} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Lines<T extends Record<string, unknown>>({
  data,
  x,
  y,
  height = 200,
  format = (v) => String(v),
  domain = [0, 100],
  refs = [],
  xLabel,
}: {
  data: T[];
  x: keyof T & string;
  y: keyof T & string;
  height?: number;
  format?: (v: number) => string;
  domain?: [number, number];
  refs?: { y: number; label: string; tone?: string }[];
  xLabel?: (v: string) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey={x as string} tick={tick} axisLine={false} tickLine={false} tickFormatter={xLabel} />
        <YAxis tick={tick} axisLine={false} tickLine={false} domain={domain} width={44} tickFormatter={(v) => format(Number(v))} />
        <Tooltip content={<Tip format={format} />} />
        {refs.map((r) => (
          <ReferenceLine key={r.label} y={r.y} stroke={r.tone ?? "var(--terra)"} strokeDasharray="3 3" label={{ value: r.label, position: "insideTopRight", fill: r.tone ?? "var(--terra)", fontSize: 10, fontFamily: "var(--font-mono)" }} />
        ))}
        <Line type="monotone" dataKey={y as string} stroke="var(--ink)" strokeWidth={1.5} dot={{ r: 2.5, fill: "var(--surface)", stroke: "var(--ink)" }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Horizontal share bars (no chart library needed). */
export function ShareBars({ rows, format }: { rows: { label: ReactNode; value: number; color: string; key: string }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[88px_1fr_56px] items-center gap-3 text-xs">
          <span className="num truncate text-muted">{r.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-line">
            <span className="block h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </span>
          <span className="num text-right text-ink">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}
