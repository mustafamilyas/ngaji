"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ResultDatum = { label: string; count: number; percent?: number };

const barFill = "var(--chart-3)";
const tooltipStyle = { fontSize: 12, background: "var(--popover, white)", border: "1px solid var(--border)" };

function describe(count: number, percent?: number) {
  return percent === undefined ? String(count) : `${count} (${percent}%)`;
}

/**
 * Bars for one question: horizontal for choice options (long labels read
 * better on a phone), vertical columns for scale values. Exact figures are
 * printed next to each bar, so the chart works without hovering.
 */
export function ResultChart({
  data,
  orientation,
  ariaLabel,
}: {
  data: ResultDatum[];
  orientation: "horizontal" | "vertical";
  ariaLabel: string;
}) {
  const formatLabel = (value: unknown, _name?: unknown, item?: { payload?: ResultDatum }) =>
    describe(Number(value), item?.payload?.percent);
  const rows = data.map((d) => ({ ...d, text: describe(d.count, d.percent) }));

  if (orientation === "horizontal") {
    return (
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={Math.max(120, data.length * 40 + 16)}>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 72, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
            <YAxis
              type="category"
              dataKey="label"
              width={112}
              tick={{ fontSize: 12 }}
              stroke="var(--muted-foreground)"
            />
            <Tooltip contentStyle={tooltipStyle} formatter={formatLabel} />
            <Bar dataKey="count" fill={barFill} radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
              <LabelList dataKey="text" position="right" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
          <Tooltip contentStyle={tooltipStyle} formatter={formatLabel} />
          <Bar dataKey="count" fill={barFill} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
            <LabelList dataKey="text" position="top" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
