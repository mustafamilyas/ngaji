"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ActivityStatistics } from "@/lib/stats";

const tooltipStyle = { fontSize: 12, background: "var(--popover, white)", border: "1px solid var(--border)" };

export function ActivityCharts({ stats }: { stats: ActivityStatistics }) {
  const totalExpected = stats.occurrences.reduce((sum, o) => sum + o.expected, 0);
  const totalHadir = stats.occurrences.reduce((sum, o) => sum + o.hadir, 0);
  const totalIzin = stats.occurrences.reduce((sum, o) => sum + o.izin, 0);
  const totalAbsent = stats.occurrences.reduce((sum, o) => sum + o.absent, 0);
  const overallPercent = totalExpected > 0 ? Math.round((totalHadir / totalExpected) * 1000) / 10 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Occurrence" value={stats.occurrences.length} />
        <StatTile label="Hadir" value={totalHadir} tone="good" />
        <StatTile label="Izin" value={totalIzin} tone="warning" />
        <StatTile label="Tidak hadir" value={totalAbsent} tone="critical" />
      </div>
      <div className="rounded-md border p-4">
        <p className="text-xs text-muted-foreground">% hadir keseluruhan</p>
        <p className="text-3xl font-semibold">{overallPercent}%</p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Tren % hadir</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={stats.trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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

      {stats.byDirectSubGroup.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">% hadir per sub-grup</h3>
          <ul className="flex flex-col divide-y text-sm">
            {stats.byDirectSubGroup.map((g) => (
              <li key={g.groupId} className="flex items-center justify-between py-2">
                <span>{g.groupName}</span>
                <span className="text-muted-foreground">{g.percentHadir}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium">Per occurrence</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2">Tanggal</th>
                <th className="py-2 pr-2">Kegiatan</th>
                <th className="py-2 pr-2 text-right">Hadir</th>
                <th className="py-2 pr-2 text-right">Izin</th>
                <th className="py-2 pr-2 text-right">Absen</th>
                <th className="py-2 pr-2 text-right">Expected</th>
                <th className="py-2 text-right">% Hadir</th>
              </tr>
            </thead>
            <tbody>
              {stats.occurrences.map((o) => (
                <tr key={`${o.activityId}:${o.effectiveDate}`} className="border-b last:border-0">
                  <td className="py-2 pr-2">{o.effectiveDate}</td>
                  <td className="py-2 pr-2">{o.activityName}</td>
                  <td className="py-2 pr-2 text-right">{o.hadir}</td>
                  <td className="py-2 pr-2 text-right">{o.izin}</td>
                  <td className="py-2 pr-2 text-right">{o.absent}</td>
                  <td className="py-2 pr-2 text-right">{o.expected}</td>
                  <td className="py-2 text-right">{o.percentHadir}%</td>
                </tr>
              ))}
              {stats.occurrences.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-muted-foreground">
                    Tidak ada occurrence pada rentang ini.
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

const TONE_CLASS = {
  good: "text-emerald-700 dark:text-emerald-400",
  warning: "text-amber-700 dark:text-amber-400",
  critical: "text-destructive",
} as const;

function StatTile({ label, value, tone }: { label: string; value: number; tone?: keyof typeof TONE_CLASS }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${tone ? TONE_CLASS[tone] : ""}`}>{value}</p>
    </div>
  );
}
