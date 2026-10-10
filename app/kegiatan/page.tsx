import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  CalendarX,
  ClipboardCheck,
  Eye,
  List,
  Network,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { auth } from "@/auth";
import { SortableTh, StatTile, StatTiles, TableCard, tableClass, tdClass, thClass, theadRowClass, trClass } from "@/components/data-table";
import { MetaItem, PageHeader } from "@/components/page-header";
import { RowActions } from "@/components/row-actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { FilterBar, SearchFilter } from "@/components/filters/filter-bar";
import { GroupFilter } from "@/components/filters/group-filter";
import { ActivityCalendar } from "./activity-calendar";
import { WEEKDAY_LABELS } from "@/lib/activity/labels";
import { listActivityOccurrences } from "@/lib/activity/list";
import { ACTIVITY_SORT_KEYS, type ActivitySortKey, DEFAULT_ACTIVITY_SORT, sortActivityEntries } from "@/lib/activity/list-sort";
import { visibleGroupsWhere } from "@/lib/authz";
import { ACTIVITY_LIST_DATE_RANGE, PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { today, weekdayOf } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { formatDate, formatDateRange, parseGroupIds, parsePage, parseSearch, resolveDateRange } from "@/lib/filters";
import { pageHref, paginate } from "@/lib/pagination";
import { parseSort, sortHref, sortPreserve } from "@/lib/sort";
import { cn } from "@/lib/utils";

export default async function ActivityListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;

  const now = today();
  const dateRange = resolveDateRange(params, ACTIVITY_LIST_DATE_RANGE, now);
  const { mode: range, anchor } = dateRange;
  // ACTIVITY_LIST_DATE_RANGE has no open-ended mode, so both bounds are always set.
  const from = dateRange.from!;
  const to = dateRange.to!;

  const view = params.view === "calendar" ? "calendar" : "list";

  const groupIds = parseGroupIds(params.grup);
  const q = parseSearch(params.q);
  const page = parsePage(params.page);

  const [{ entries, groups }, visibleGroups] = await Promise.all([
    (async () => {
      try {
        return await listActivityOccurrences(session.user, { from, to, groupIds, search: q });
      } catch (error) {
        if (error instanceof NotFoundError) notFound();
        throw error;
      }
    })(),
    db.group.findMany({
      where: visibleGroupsWhere(session.user),
      orderBy: [{ depth: "asc" }, { name: "asc" }],
      select: { id: true, parentId: true, name: true, path: true },
    }),
  ]);

  const sort = parseSort(params, ACTIVITY_SORT_KEYS, DEFAULT_ACTIVITY_SORT);

  function hrefWith(overrides: Record<string, string | undefined>): string {
    const sp = new URLSearchParams();
    if (groupIds) sp.set("grup", groupIds.join(","));
    if (q) sp.set("q", q);
    sp.set("range", range);
    if (range === "custom") {
      sp.set("from", from);
      sp.set("to", to);
    } else {
      sp.set("anchor", anchor);
    }
    sp.set("view", view);
    for (const [key, value] of Object.entries(sortPreserve(sort, DEFAULT_ACTIVITY_SORT))) sp.set(key, value);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) sp.delete(key);
      else sp.set(key, value);
    }
    return `/kegiatan?${sp.toString()}`;
  }

  function dayHref(date: string): string {
    return hrefWith({ view: "list", range: "custom", from: date, to: date, anchor: undefined });
  }

  const sorted = sortActivityEntries(entries, sort);
  const listPage = paginate(sorted, page, PAGE_SIZE);

  const groupsLabel = groups.length === 1 ? groups[0].name : `${groups.length} grup`;
  const isFiltered = Boolean(groupIds || q || range !== ACTIVITY_LIST_DATE_RANGE.defaultMode || anchor !== now);
  const todayCount = entries.filter((e) => e.effectiveDate === now && e.status !== "CANCELLED").length;
  const conflictCount = entries.filter((e) => e.hasConflict).length;
  const cancelledCount = entries.filter((e) => e.status === "CANCELLED").length;
  const th = (key: ActivitySortKey, label: string) => (
    <SortableTh
      label={label}
      href={sortHref("/kegiatan", params, key, sort, DEFAULT_ACTIVITY_SORT)}
      dir={sort.key === key ? sort.dir : undefined}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kegiatan"
        meta={
          <>
            <MetaItem icon={Network}>{groupsLabel}</MetaItem>
            <MetaItem icon={CalendarRange}>{formatDateRange(from, to)}</MetaItem>
          </>
        }
        actions={
          <Link href="/kegiatan/baru" className={buttonVariants({ size: "lg" })}>
            <Plus />
            Kegiatan baru
          </Link>
        }
      />

      <StatTiles>
        <StatTile icon={CalendarDays} label="Jadwal di rentang ini" value={entries.length} />
        <StatTile icon={CalendarCheck} label="Hari ini" value={todayCount} />
        <StatTile icon={TriangleAlert} label="Konflik" value={conflictCount} hint="Jadwal yang bertabrakan" />
        <StatTile icon={CalendarX} label="Batal" value={cancelledCount} />
      </StatTiles>

      <TableCard
        title={
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Tampilan">
              {(
                [
                  ["list", "Daftar", List],
                  ["calendar", "Kalender", CalendarDays],
                ] as const
              ).map(([key, label, Icon]) => (
                <Link
                  key={key}
                  href={hrefWith({ view: key })}
                  scroll={false}
                  aria-current={view === key ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm",
                    view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
            </div>
            {view === "list" && (
              <span>
                <span className="font-medium text-foreground">{entries.length}</span> jadwal
              </span>
            )}
          </div>
        }
        toolbar={
          <FilterBar
            action="/kegiatan"
            preserve={{
              view: view === "calendar" ? "calendar" : undefined,
              ...sortPreserve(sort, DEFAULT_ACTIVITY_SORT),
            }}
            isFiltered={isFiltered}
            resetHref={view === "calendar" ? "/kegiatan?view=calendar" : "/kegiatan"}
          >
            <SearchFilter value={q} placeholder="Cari kegiatan…" />
            <GroupFilter
              groups={visibleGroups}
              selected={groupIds ?? [session.user.groupId]}
              active={Boolean(groupIds)}
              withDescendantsAction
              hint="Menampilkan kegiatan yang berlaku untuk grup terpilih, termasuk dari grup induknya."
            />
            <DateRangeFilter range={dateRange} {...ACTIVITY_LIST_DATE_RANGE} today={now} />
          </FilterBar>
        }
        footer={
          view === "list" && entries.length > PAGE_SIZE ? (
            <Pagination {...listPage} hrefFor={(target) => pageHref("/kegiatan", params, target)} />
          ) : undefined
        }
      >
        {view === "calendar" ? (
          <div className="p-4">
            <ActivityCalendar entries={entries} month={from} dayHref={dayHref} />
          </div>
        ) : entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr className={theadRowClass}>
                  {th("tanggal", "Tanggal")}
                  {th("kegiatan", "Kegiatan")}
                  {th("grup", "Grup")}
                  {th("lokasi", "Lokasi")}
                  <th scope="col" className={cn(thClass, "w-12")}>
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {listPage.items.map((entry) => {
                  const cancelled = entry.status === "CANCELLED";
                  const attendanceHref = `/kegiatan/${entry.activityId}/${entry.key}`;
                  const canRecordNow = entry.canRecord && !cancelled && entry.effectiveDate <= now;
                  return (
                    <tr key={`${entry.activityId}:${entry.key}`} className={trClass}>
                      <td className={cn(tdClass, "tabular-nums")}>
                        <span className={cn(cancelled && "text-muted-foreground line-through")}>
                          {WEEKDAY_LABELS[weekdayOf(entry.effectiveDate)].slice(0, 3)}, {formatDate(entry.effectiveDate)}
                        </span>
                        <span className="block text-xs text-muted-foreground">{entry.effectiveStartTime}</span>
                      </td>
                      <td className={tdClass}>
                        <Link href={`/kegiatan/${entry.activityId}`} className="font-medium hover:underline">
                          {entry.activityName}
                        </Link>
                        <span className="mt-0.5 flex flex-wrap gap-1">
                          {entry.effectiveDate === now && !cancelled && <Badge>Hari ini</Badge>}
                          {entry.inherited && <Badge variant="secondary">Warisan</Badge>}
                          {entry.moved && <Badge variant="outline">Dipindah</Badge>}
                          {cancelled && <Badge variant="destructive">Batal</Badge>}
                          {entry.hasConflict && (
                            <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Konflik</Badge>
                          )}
                        </span>
                      </td>
                      <td className={tdClass}>{entry.groupName}</td>
                      <td className={cn(tdClass, "max-w-56 truncate text-muted-foreground")} title={entry.effectiveLocation}>
                        {entry.effectiveLocation}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <RowActions
                          label={`${entry.activityName} ${formatDate(entry.effectiveDate)}`}
                          actions={[
                            {
                              label: canRecordNow ? "Isi absensi" : "Lihat absensi",
                              href: attendanceHref,
                              icon: <ClipboardCheck />,
                            },
                            { label: "Detail kegiatan", href: `/kegiatan/${entry.activityId}`, icon: <Eye /> },
                            { label: "Jadwal", href: `/kegiatan/${entry.activityId}?tab=jadwal`, icon: <CalendarDays /> },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {q ? "Tidak ada kegiatan yang cocok." : "Tidak ada kegiatan pada rentang ini."}
          </p>
        )}
      </TableCard>
    </div>
  );
}
