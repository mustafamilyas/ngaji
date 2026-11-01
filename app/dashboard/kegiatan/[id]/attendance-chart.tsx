"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tooltipStyle = { fontSize: 12, background: "var(--popover, white)", border: "1px solid var(--border)" };

const TONE_CLASS = {
  good: "text-emerald-700 dark:text-emerald-400",
  warning: "text-amber-700 dark:text-amber-400",
  critical: "text-destructive",
} as const;

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${tone ? TONE_CLASS[tone] : ""}`}>{value}</p>
    </div>
  );
}

export type AttendanceTotals = { occurrenceCount: number; hadir: number; izin: number; absent: number; percentHadir: number };

/**
 * Whole-activity aggregate of the Absensi tab (metric tiles + % hadir trend line chart). Only totals and trend
 * points cross to the browser: the per-occurrence and per-member tables are rendered on the server, one page each.
 */
export function ActivityAttendanceChart({
  from,
  to,
  totals,
  trend,
}: {
  from: string;
  to: string;
  totals: AttendanceTotals;
  /** Oldest first. */
  trend: { date: string; percentHadir: number }[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-medium">
          Ringkasan ({from} – {to})
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Occurrence" value={totals.occurrenceCount} />
          <StatTile label="Hadir" value={totals.hadir} tone="good" />
          <StatTile label="Izin" value={totals.izin} tone="warning" />
          <StatTile label="Tidak hadir" value={totals.absent} tone="critical" />
        </div>
        <div className="mt-2 rounded-md border p-4">
          <p className="text-xs text-muted-foreground">% hadir keseluruhan</p>
          <p className="text-3xl font-semibold">{totals.percentHadir}%</p>
        </div>
      </div>

      {trend.length > 1 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Tren % hadir</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, "% hadir"]} />
              <Line
                type="monotone"
                dataKey="percentHadir"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
