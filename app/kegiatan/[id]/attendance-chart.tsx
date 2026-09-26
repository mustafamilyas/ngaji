"use client";

import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ActivityAttendanceSummary } from "@/lib/stats";

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

/**
 * Attendance for one activity's own detail page, split in two per DESIGN.md
 * (§6 narrowed to one activity): the whole-activity aggregate (metric tiles
 * + % hadir trend line chart) and the single-occurrence breakdown (table).
 */
export function ActivityAttendanceChart({
  summary,
  rangeDays,
  activityId,
  canRecord,
}: {
  summary: ActivityAttendanceSummary;
  rangeDays: number;
  activityId: number;
  canRecord: boolean;
}) {
  const totalAbsent = summary.totalExpected - summary.totalHadir - summary.totalIzin;
  const trend = [...summary.occurrences]
    .reverse()
    .map((o) => ({ date: o.effectiveDate, percentHadir: o.percentHadir }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-medium">Ringkasan ({rangeDays} hari terakhir)</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Occurrence" value={summary.occurrences.length} />
          <StatTile label="Hadir" value={summary.totalHadir} tone="good" />
          <StatTile label="Izin" value={summary.totalIzin} tone="warning" />
          <StatTile label="Tidak hadir" value={totalAbsent} tone="critical" />
        </div>
        <div className="mt-2 rounded-md border p-4">
          <p className="text-xs text-muted-foreground">% hadir keseluruhan</p>
          <p className="text-3xl font-semibold">{summary.percentHadir}%</p>
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

      <div>
        <h3 className="mb-2 text-sm font-medium">Per occurrence</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2">Tanggal</th>
                <th className="py-2 pr-2 text-right">Hadir</th>
                <th className="py-2 pr-2 text-right">Izin</th>
                <th className="py-2 pr-2 text-right">Tidak hadir</th>
                <th className="py-2 pr-2 text-right">Expected</th>
                <th className="py-2 pr-2 text-right">% Hadir</th>
                {canRecord && <th className="py-2 pl-2 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {summary.occurrences.map((o) => (
                <tr key={o.key} className="border-b last:border-0">
                  <td className="py-2 pr-2">{o.effectiveDate}</td>
                  <td className="py-2 pr-2 text-right">{o.hadir}</td>
                  <td className="py-2 pr-2 text-right">{o.izin}</td>
                  <td className="py-2 pr-2 text-right">{o.absent}</td>
                  <td className="py-2 pr-2 text-right">{o.expected}</td>
                  <td className="py-2 pr-2 text-right">{o.percentHadir}%</td>
                  {canRecord && (
                    <td className="py-2 pl-2 text-right">
                      <Link href={`/kegiatan/${activityId}/${o.key}`} className="text-xs text-primary hover:underline">
                        Lihat
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
              {summary.occurrences.length === 0 && (
                <tr>
                  <td colSpan={canRecord ? 7 : 6} className="py-4 text-center text-muted-foreground">
                    Belum ada riwayat absensi dalam {rangeDays} hari terakhir.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
