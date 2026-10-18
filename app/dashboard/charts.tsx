"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { weekdayOf } from "@/lib/dates";

const tooltipStyle = { fontSize: 12, background: "var(--popover, white)", border: "1px solid var(--border)" };
const WEEKDAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function WeeklyAttendanceChart({ trend }: { trend: { date: string; percentHadir: number }[] }) {
  const data = trend.slice(-7);
  const highest = Math.max(...data.map((d) => d.percentHadir));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          stroke="var(--muted-foreground)"
          tickFormatter={(date: string) => WEEKDAY_LABELS[weekdayOf(date)]}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, "% hadir"]} />
        <Bar dataKey="percentHadir" radius={[6, 6, 0, 0]} isAnimationActive={false}>
          {data.map((entry) => (
            <Cell
              key={entry.date}
              fill={entry.percentHadir === highest ? "var(--primary)" : "var(--muted)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AttendanceDonut({ percent }: { percent: number }) {
  const data = [
    { name: "Hadir", value: percent },
    { name: "Sisa", value: Math.max(0, 100 - percent) },
  ];

  return (
    <div className="relative flex w-full items-center justify-center">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={58}
            outerRadius={78}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill="var(--primary)" />
            <Cell fill="var(--muted)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold">{percent}%</span>
        <span className="text-xs text-muted-foreground">Kehadiran</span>
      </div>
    </div>
  );
}
