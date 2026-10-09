import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { visibleGroupsWhere } from "@/lib/authz";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { FilterBar, SearchFilter } from "@/components/filters/filter-bar";
import { GroupFilter } from "@/components/filters/group-filter";
import { STATS_DATE_RANGE } from "@/lib/constants";
import { db } from "@/lib/db";
import { today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { parseGroupIds, parseSearch, resolveDateRange } from "@/lib/filters";
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

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const tab: TabKey = typeof params.tab === "string" && isTabKey(params.tab) ? params.tab : "anggota";
  const now = today();
  const range = resolveDateRange(params, STATS_DATE_RANGE, now);
  // STATS_DATE_RANGE has no open-ended mode, so both bounds are always set.
  const from = range.from!;
  const to = range.to!;
  // Statistics are computed for one scope group (breakdowns are per direct sub-group), so only the first id counts.
  const grup = parseGroupIds(params.grup)?.[0];
  const q = tab === "partisipasi" ? parseSearch(params.q) : undefined;

  const groups = await db.group.findMany({
    where: visibleGroupsWhere(session.user),
    orderBy: [{ depth: "asc" }, { name: "asc" }],
    select: { id: true, parentId: true, name: true, path: true },
  });
  const ownGroupName = groups.find((g) => g.id === session.user.groupId)?.name ?? "Grup saya";

  const rangeParams: Record<string, string | undefined> = {
    range: range.mode,
    anchor: range.mode !== "custom" && range.anchor !== now ? range.anchor : undefined,
    from: range.mode === "custom" ? from : undefined,
    to: range.mode === "custom" ? to : undefined,
  };

  function tabHref(key: string) {
    const next = new URLSearchParams({ tab: key });
    for (const [name, value] of Object.entries(rangeParams)) if (value) next.set(name, value);
    if (grup) next.set("grup", String(grup));
    return `/statistik?${next.toString()}`;
  }

  const rangeFiltered = range.mode !== STATS_DATE_RANGE.defaultMode || range.anchor !== now;

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
      const rows = await participationStatistics(session.user, { from, to, groupId: grup });
      const needle = q?.toLocaleLowerCase("id-ID");
      data = { tab, rows: needle ? rows.filter((r) => r.memberName.toLocaleLowerCase("id-ID").includes(needle)) : rows };
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

      <FilterBar
        action="/statistik"
        preserve={{
          tab,
          // The anggota tab has no date filter; keep the chosen range for the other tabs.
          ...(tab === "anggota" ? rangeParams : {}),
        }}
        isFiltered={Boolean(grup || q || (tab !== "anggota" && rangeFiltered))}
        resetHref={`/statistik?tab=${tab}`}
      >
        {tab === "partisipasi" && <SearchFilter value={q} placeholder="Cari nama anggota…" />}
        <GroupFilter
          groups={groups}
          selected={grup ? [grup] : []}
          mode="single"
          emptyLabel={ownGroupName}
          hint="Statistik dihitung untuk grup ini dan semua grup di bawahnya."
        />
        {tab !== "anggota" && <DateRangeFilter range={range} {...STATS_DATE_RANGE} today={now} />}
      </FilterBar>

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
