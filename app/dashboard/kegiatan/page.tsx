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
  Printer,
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
import { SortSelect } from "@/components/filters/sort-select";
import { ActivityCalendar } from "./activity-calendar";
import { OccurrenceNotes } from "./occurrence-notes";
import { WEEKDAY_LABELS } from "@/lib/activity/labels";
import { listActivityOccurrences } from "@/lib/activity/list";
import { ACTIVITY_SORT_KEYS, type ActivitySortKey, DEFAULT_ACTIVITY_SORT, sortActivityEntries } from "@/lib/activity/list-sort";
import { visibleGroupsWhere } from "@/lib/authz";
import { ACTIVITY_CALENDAR_DATE_RANGE, ACTIVITY_LIST_DATE_RANGE, PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { today, weekdayOf } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { formatDate, formatDateRange, parseGroupIds, parsePage, parseSearch, parseTagIds, resolveDateRange } from "@/lib/filters";
import { pageHref, paginate } from "@/lib/pagination";
import { parseSort, sortHref, sortPreserve } from "@/lib/sort";
import { cn } from "@/lib/utils";

/** Table cell that becomes a plain stacked block below md. */
const stackedCell = "block px-0 py-0 whitespace-normal md:table-cell md:px-4 md:py-2.5 md:whitespace-nowrap";

export default async function ActivityListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;

  const now = today(session.user.timeZone);
  const view = params.view === "calendar" ? "calendar" : "list";
  // The calendar only shows whole calendar periods (day, week, month), so it has no free from–to range.
  const rangeConfig = view === "calendar" ? ACTIVITY_CALENDAR_DATE_RANGE : ACTIVITY_LIST_DATE_RANGE;
  const dateRange = resolveDateRange(params, rangeConfig, now);
  const { mode: range, anchor } = dateRange;
  // ACTIVITY_LIST_DATE_RANGE has no open-ended mode, so both bounds are always set.
  const from = dateRange.from!;
  const to = dateRange.to!;

  const groupIds = parseGroupIds(params.grup);
  const q = parseSearch(params.q);
  const tagIds = parseTagIds(params.tag);
  const page = parsePage(params.page);

  const [{ entries, groups }, visibleGroups] = await Promise.all([
    (async () => {
      try {
        return await listActivityOccurrences(session.user, { from, to, groupIds, search: q, tagIds });
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
    if (tagIds) sp.set("tag", tagIds.join(","));
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
    return `/dashboard/kegiatan?${sp.toString()}`;
  }

  function dayHref(date: string): string {
    return hrefWith({ view: "list", range: "custom", from: date, to: date, anchor: undefined });
  }

  const printHref = hrefWith({ view: undefined, sort: undefined, dir: undefined }).replace(
    "/dashboard/kegiatan?",
    "/dashboard/kegiatan/cetak?",
  );

  const sorted = sortActivityEntries(entries, sort);
  const listPage = paginate(sorted, page, PAGE_SIZE);

  const groupsLabel = groups.length === 1 ? groups[0].name : `${groups.length} grup`;
  const isFiltered = Boolean(groupIds || q || tagIds || range !== ACTIVITY_LIST_DATE_RANGE.defaultMode || anchor !== now);
  const todayCount = entries.filter((e) => e.effectiveDate === now && e.status !== "CANCELLED").length;
  const conflictCount = entries.filter((e) => e.hasConflict).length;
  const cancelledCount = entries.filter((e) => e.status === "CANCELLED").length;
  const th = (key: ActivitySortKey, label: string) => (
    <SortableTh
      label={label}
      href={sortHref("/dashboard/kegiatan", params, key, sort, DEFAULT_ACTIVITY_SORT)}
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
          <>
            <Link href={printHref} className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 text-base xl:h-9 xl:text-sm")}>
              <Printer />
              Cetak
            </Link>
            <Link href="/dashboard/kegiatan/baru" className={cn(buttonVariants({ size: "lg" }), "h-11 text-base xl:h-9 xl:text-sm")}>
              <Plus />
              Kegiatan baru
            </Link>
          </>
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
                    "inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-1 text-base xl:min-h-0 xl:px-2.5 xl:text-sm",
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
            action="/dashboard/kegiatan"
            preserve={{ view: view === "calendar" ? "calendar" : undefined }}
            isFiltered={isFiltered}
            resetHref={view === "calendar" ? "/dashboard/kegiatan?view=calendar" : "/dashboard/kegiatan"}
          >
            <SearchFilter value={q} placeholder="Cari kegiatan…" />
            <GroupFilter
              groups={visibleGroups}
              selected={groupIds ?? [session.user.groupId]}
              active={Boolean(groupIds)}
              withDescendantsAction
              hint="Menampilkan kegiatan yang berlaku untuk grup terpilih, termasuk dari grup induknya."
            />
            <DateRangeFilter range={dateRange} {...rangeConfig} today={now} />
            {view === "list" && (
              <SortSelect
                options={[
                  { key: "tanggal", label: "Tanggal" },
                  { key: "kegiatan", label: "Kegiatan" },
                  { key: "grup", label: "Grup" },
                  { key: "lokasi", label: "Lokasi" },
                ]}
                current={sort}
                fallback={DEFAULT_ACTIVITY_SORT}
              />
            )}
          </FilterBar>
        }
        footer={
          view === "list" && entries.length > PAGE_SIZE ? (
            <Pagination {...listPage} hrefFor={(target) => pageHref("/dashboard/kegiatan", params, target)} />
          ) : undefined
        }
      >
        {view === "calendar" ? (
          <div className="p-1 sm:p-4">
            <ActivityCalendar entries={entries} from={from} to={to} today={now} dayHref={dayHref} />
          </div>
        ) : entries.length > 0 ? (
          <div className="overflow-x-auto">
            {/* Below md the same table markup is laid out as stacked rows (no sideways scrolling); sort headers are table-only. */}
            <table className={cn(tableClass, "block md:table")}>
              <thead className="hidden md:table-header-group">
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
              <tbody className="block md:table-row-group">
                {listPage.items.map((entry) => {
                  const cancelled = entry.status === "CANCELLED";
                  const attendanceHref = `/dashboard/kegiatan/${entry.activityId}/${entry.key}`;
                  const canRecordNow = entry.canRecord && !cancelled && entry.effectiveDate <= now;
                  return (
                    <tr
                      key={`${entry.activityId}:${entry.key}`}
                      className={cn(trClass, "grid grid-cols-[1fr_auto] gap-x-2 px-4 py-3 md:table-row md:p-0")}
                    >
                      <td className={cn(tdClass, stackedCell, "col-start-1 tabular-nums")}>
                        <span className={cn(cancelled && "text-muted-foreground line-through")}>
                          {WEEKDAY_LABELS[weekdayOf(entry.effectiveDate)].slice(0, 3)}, {formatDate(entry.effectiveDate)}
                        </span>
                        <span className="block text-xs text-muted-foreground">{entry.effectiveStartTime}</span>
                      </td>
                      <td className={cn(tdClass, stackedCell, "col-start-1")}>
                        <Link
                          href={`/dashboard/kegiatan/${entry.activityId}`}
                          className="inline-flex min-h-11 items-center font-medium hover:underline xl:min-h-0"
                        >
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
                        <OccurrenceNotes notes={entry.effectiveNotes} />
                      </td>
                      <td className={cn(tdClass, stackedCell, "col-start-1 text-xs text-muted-foreground md:text-sm md:text-foreground")}>
                        {entry.groupName}
                      </td>
                      <td
                        className={cn(tdClass, stackedCell, "col-start-1 text-xs text-muted-foreground md:max-w-56 md:truncate md:text-sm")}
                        title={entry.effectiveLocation}
                      >
                        {entry.effectiveLocation}
                      </td>
                      <td className="col-start-2 row-start-1 row-span-2 self-start px-0 py-0 text-right md:px-2 md:py-1">
                        <RowActions
                          className="size-11 xl:size-8"
                          label={`${entry.activityName} ${formatDate(entry.effectiveDate)}`}
                          actions={[
                            {
                              label: canRecordNow ? "Isi absensi" : "Lihat absensi",
                              href: attendanceHref,
                              icon: <ClipboardCheck />,
                            },
                            { label: "Detail kegiatan", href: `/dashboard/kegiatan/${entry.activityId}`, icon: <Eye /> },
                            { label: "Jadwal", href: `/dashboard/kegiatan/${entry.activityId}?tab=jadwal`, icon: <CalendarDays /> },
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
