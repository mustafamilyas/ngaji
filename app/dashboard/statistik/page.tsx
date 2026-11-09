import { notFound, redirect } from "next/navigation";
import { CalendarDays, CalendarRange, Network, UserCheck, Users } from "lucide-react";
import { auth } from "@/auth";
import { MetaItem, PageHeader } from "@/components/page-header";
import { TabNav } from "@/components/tab-nav";
import { visibleGroupsWhere } from "@/lib/authz";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { FilterBar, SearchFilter } from "@/components/filters/filter-bar";
import { GroupFilter } from "@/components/filters/group-filter";
import { STATS_DATE_RANGE } from "@/lib/constants";
import { db } from "@/lib/db";
import { today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { breakdownParam, formatDateRange, parseBreakdown, parseGroupIds, parsePage, parseSearch, parseTagId, resolveDateRange } from "@/lib/filters";
import { resolveBreakdown } from "@/lib/summary/breakdown";
import { participationPage } from "@/lib/participation/page";
import { DEFAULT_PARTICIPATION_SORT, PARTICIPATION_SORT_KEYS, parseSort, sortPreserve } from "@/lib/sort";
import { parseTab } from "@/lib/tabs";
import { tagChoices } from "@/lib/tag/choices";
import { loadTagOptions } from "@/lib/tag/entity";
import { activityStatistics, memberStatistics, participationStatistics } from "@/lib/stats";
import { BreakdownSection } from "@/components/breakdown/breakdown-section";
import { ActivityCharts } from "./activity-charts";
import { MemberCharts } from "./member-charts";
import { ParticipationTable } from "./participation-table";
import { TagBreakdownCard } from "./tag-breakdown-card";

const TABS = [
  { key: "anggota", label: "Anggota", icon: Users },
  { key: "kegiatan", label: "Kegiatan", icon: CalendarDays },
  { key: "partisipasi", label: "Partisipasi", icon: UserCheck },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const tab = parseTab(params.tab, TABS.map((t) => t.key), "anggota" as TabKey);
  const now = today(session.user.timeZone);
  const range = resolveDateRange(params, STATS_DATE_RANGE, now);
  // STATS_DATE_RANGE has no open-ended mode, so both bounds are always set.
  const from = range.from!;
  const to = range.to!;
  // Statistics are computed for one scope group (breakdowns are per direct sub-group), so only the first id counts.
  const grup = parseGroupIds(params.grup)?.[0];
  const q = tab === "partisipasi" ? parseSearch(params.q) : undefined;
  const participationSort = parseSort(params, PARTICIPATION_SORT_KEYS, DEFAULT_PARTICIPATION_SORT);

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
    return `/dashboard/statistik?${next.toString()}`;
  }

  const rangeFiltered = range.mode !== STATS_DATE_RANGE.defaultMode || range.anchor !== now;

  let rincian: string | undefined;
  let data:
    | { tab: "anggota"; stats: Awaited<ReturnType<typeof memberStatistics>> }
    | { tab: "kegiatan"; stats: Awaited<ReturnType<typeof activityStatistics>> }
    | { tab: "partisipasi"; page: ReturnType<typeof participationPage> };
  try {
    if (tab === "anggota") {
      data = { tab, stats: await memberStatistics(session.user, grup, { tagId: parseTagId(params.tag) }) };
    } else if (tab === "kegiatan") {
      const choice = parseBreakdown(params.rincian);
      const breakdown = await resolveBreakdown(session.user, choice);
      // An unusable choice (invisible tag…) resolves to none: no breakdown, no error.
      rincian = breakdown && choice ? breakdownParam(choice) : undefined;
      data = { tab, stats: await activityStatistics(session.user, { from, to, groupId: grup, breakdown }) };
    } else {
      const rows = await participationStatistics(session.user, { from, to, groupId: grup });
      data = { tab, page: participationPage(rows, { sort: participationSort, page: parsePage(params.page), q }) };
    }
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  // "Per tag" only needs the tags the viewer can see; an id outside them was already ignored by memberStatistics.
  const tagCardQuery: Record<string, string> = { tab };
  if (grup) tagCardQuery.grup = String(grup);

  const content =
    data.tab === "anggota" ? (
      <div className="flex flex-col gap-6">
        <MemberCharts stats={data.stats} />
        <TagBreakdownCard
          choices={tagChoices((await loadTagOptions(session.user)).visible)}
          breakdown={data.stats.byTag}
          total={data.stats.total}
          basePath="/dashboard/statistik"
          query={tagCardQuery}
        />
      </div>
    ) : data.tab === "kegiatan" ? (
      <div className="flex flex-col gap-6">
        <ActivityCharts stats={data.stats} />
        <BreakdownSection
          choices={tagChoices((await loadTagOptions(session.user)).visible)}
          breakdown={data.stats.breakdown}
          selected={rincian}
          basePath="/dashboard/statistik"
          searchParams={{ ...params, tab }}
          page={parsePage(params.rincianhal)}
        />
      </div>
    ) : (
      <ParticipationTable page={data.page} sort={participationSort} basePath="/dashboard/statistik" searchParams={{ ...params, tab }} />
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Statistik"
        meta={
          <>
            <MetaItem icon={Network}>{groups.find((g) => g.id === grup)?.name ?? ownGroupName}</MetaItem>
            {tab !== "anggota" && <MetaItem icon={CalendarRange}>{formatDateRange(from, to)}</MetaItem>}
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <TabNav
          path="/dashboard/statistik"
          current={tab}
          defaultTab="anggota"
          tabs={TABS.map((t) => ({ ...t, href: tabHref(t.key) }))}
        />

        <FilterBar
          action="/dashboard/statistik"
          preserve={{
            tab,
            // The anggota tab has no date filter; keep the chosen range for the other tabs.
            ...(tab === "anggota" ? rangeParams : {}),
            // The breakdown choice survives a range or group change.
            ...(tab === "kegiatan" && rincian ? { rincian } : {}),
            // A filter change keeps the chosen order (and, because `page` is not preserved, starts at page 1).
            ...(tab === "partisipasi" ? sortPreserve(participationSort, DEFAULT_PARTICIPATION_SORT) : {}),
          }}
          isFiltered={Boolean(grup || q || (tab !== "anggota" && rangeFiltered))}
          resetHref={`/dashboard/statistik?tab=${tab}`}
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

        {content}
      </div>
    </div>
  );
}
