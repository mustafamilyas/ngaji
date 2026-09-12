import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { visibleGroupsWhere } from "@/lib/authz";
import { DEFAULT_STATS_RANGE_DAYS } from "@/lib/constants";
import { db } from "@/lib/db";
import { addDays, today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { activityStatistics, memberStatistics, participationStatistics } from "@/lib/stats";
import { ActivityCharts } from "./activity-charts";
import { MemberCharts } from "./member-charts";
import { ParticipationTable } from "./participation-table";

const TABS = [
  { key: "anggota", label: "Anggota" },
  { key: "kegiatan", label: "Kegiatan" },
  { key: "partisipasi", label: "Partisipasi" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isTabKey(value: string): value is TabKey {
  return TABS.some((t) => t.key === value);
}

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const tab: TabKey = typeof params.tab === "string" && isTabKey(params.tab) ? params.tab : "anggota";
  const to = typeof params.to === "string" ? params.to : today();
  const from = typeof params.from === "string" ? params.from : addDays(to, -DEFAULT_STATS_RANGE_DAYS);
  const grup = typeof params.grup === "string" ? Number(params.grup) : undefined;

  const groups = await db.group.findMany({
    where: visibleGroupsWhere(session.user),
    orderBy: [{ depth: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  function tabHref(key: string) {
    const next = new URLSearchParams({ tab: key, from, to });
    if (grup) next.set("grup", String(grup));
    return `/statistik?${next.toString()}`;
  }

  let data:
    | { tab: "anggota"; stats: Awaited<ReturnType<typeof memberStatistics>> }
    | { tab: "kegiatan"; stats: Awaited<ReturnType<typeof activityStatistics>> }
    | { tab: "partisipasi"; rows: Awaited<ReturnType<typeof participationStatistics>> };
  try {
    if (tab === "anggota") {
      data = { tab, stats: await memberStatistics(session.user, grup) };
    } else if (tab === "kegiatan") {
      data = { tab, stats: await activityStatistics(session.user, { from, to, groupId: grup }) };
    } else {
      data = { tab, rows: await participationStatistics(session.user, { from, to, groupId: grup }) };
    }
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const content =
    data.tab === "anggota" ? (
      <MemberCharts stats={data.stats} />
    ) : data.tab === "kegiatan" ? (
      <ActivityCharts stats={data.stats} />
    ) : (
      <ParticipationTable rows={data.rows} />
    );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Statistik</h1>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <input type="hidden" name="tab" value={tab} />
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-xs text-muted-foreground">
            Dari
          </label>
          <input id="from" type="date" name="from" defaultValue={from} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-xs text-muted-foreground">
            Sampai
          </label>
          <input id="to" type="date" name="to" defaultValue={to} className={inputClass} />
        </div>
        <select name="grup" defaultValue={grup ?? ""} className={inputClass}>
          <option value="">Grup saya</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button type="submit" className="h-9 rounded-md border px-3 text-sm hover:bg-muted">
          Tampilkan
        </button>
      </form>

      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`rounded-t-md px-3 py-2 text-sm ${
              t.key === tab ? "border-b-2 border-primary font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {content}
    </div>
  );
}
