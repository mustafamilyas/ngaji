"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatEnumLabel, SEX_LABELS } from "@/lib/member/labels";
import type { MemberStatistics } from "@/lib/stats";

const barFill = "var(--chart-3)";

function MiniBarChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
        <Tooltip
          contentStyle={{ fontSize: 12, background: "var(--popover, white)", border: "1px solid var(--border)" }}
        />
        <Bar dataKey="count" fill={barFill} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MemberCharts({ stats }: { stats: MemberStatistics }) {
  const bySex = Object.entries(stats.bySex).map(([sex, count]) => ({
    label: SEX_LABELS[sex as keyof typeof SEX_LABELS],
    count,
  }));
  const byMaritalStatus = Object.entries(stats.byMaritalStatus).map(([status, count]) => ({
    label: formatEnumLabel(status),
    count,
  }));
  const byWorkStatus = Object.entries(stats.byWorkStatus).map(([status, count]) => ({
    label: formatEnumLabel(status),
    count,
  }));
  const byAgeBracket = Object.entries(stats.byAgeBracket).map(([label, count]) => ({
    label: formatEnumLabel(label),
    count,
  }));
  const byDirectSubGroup = stats.byDirectSubGroup.map((g) => ({ label: g.groupName, count: g.count }));

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border p-4">
        <p className="text-xs text-muted-foreground">Total anggota aktif</p>
        <p className="text-3xl font-semibold">{stats.total}</p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Kelompok umur</h3>
        <MiniBarChart data={byAgeBracket} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Jenis kelamin</h3>
        <MiniBarChart data={bySex} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Status pernikahan</h3>
        <MiniBarChart data={byMaritalStatus} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Status pekerjaan</h3>
        <MiniBarChart data={byWorkStatus} />
      </div>

      {byDirectSubGroup.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Per sub-grup</h3>
          <MiniBarChart data={byDirectSubGroup} />
        </div>
      )}
    </div>
  );
}
