"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SummaryBucket } from "@/lib/member-view/summaries";

const ROW_HEIGHT = 32;
const LABEL_WIDTH = 104;

function shorten(label: string): string {
  return label.length > 16 ? `${label.slice(0, 15)}…` : label;
}

/**
 * Horizontal bars so long labels (kelompok, tag values) stay readable on a
 * phone; the height follows the bucket count. Decorative: the same numbers are
 * always listed as text under it, so the chart is hidden from assistive tech.
 */
export function SummaryChart({ buckets }: { buckets: SummaryBucket[] }) {
  return (
    <div aria-hidden="true" data-testid="summary-chart">
      <ResponsiveContainer width="100%" height={buckets.length * ROW_HEIGHT + 16}>
        <BarChart data={buckets} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
          <YAxis
            type="category"
            dataKey="label"
            width={LABEL_WIDTH}
            tick={{ fontSize: 12 }}
            tickFormatter={shorten}
            stroke="var(--muted-foreground)"
            interval={0}
          />
          <Tooltip contentStyle={{ fontSize: 12, background: "var(--popover, white)", border: "1px solid var(--border)" }} />
          <Bar dataKey="count" name="Jumlah" fill="var(--chart-3)" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
