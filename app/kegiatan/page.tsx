import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Pagination } from "@/components/pagination";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { FilterBar, SearchFilter } from "@/components/filters/filter-bar";
import { GroupFilter } from "@/components/filters/group-filter";
import { ActivityCalendar } from "./activity-calendar";
import { listActivityOccurrences } from "@/lib/activity/list";
import { visibleGroupsWhere } from "@/lib/authz";
import { ACTIVITY_LIST_DATE_RANGE, PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { parseGroupIds, parsePage, parseSearch, resolveDateRange } from "@/lib/filters";
import { pageHref, paginate } from "@/lib/pagination";
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
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) sp.delete(key);
      else sp.set(key, value);
    }
    return `/kegiatan?${sp.toString()}`;
  }

  function dayHref(date: string): string {
    return hrefWith({ view: "list", range: "custom", from: date, to: date, anchor: undefined });
  }

  const listPage = paginate(entries, page, PAGE_SIZE);

  const groupsLabel = groups.length === 1 ? groups[0].name : `${groups.length} grup`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Kegiatan</h1>
        <Link href="/kegiatan/baru" className="text-sm text-primary hover:underline">
          Kegiatan baru
        </Link>
      </div>

      <FilterBar
        action="/kegiatan"
        preserve={{ view: view === "calendar" ? "calendar" : undefined }}
        isFiltered={Boolean(groupIds || q || range !== ACTIVITY_LIST_DATE_RANGE.defaultMode || anchor !== now)}
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

      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {view === "list" ? `${entries.length} jadwal · ` : ""}
          {groupsLabel}
        </span>
        <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Tampilan">
          {(
            [
              ["list", "Daftar"],
              ["calendar", "Kalender"],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={hrefWith({ view: key })}
              scroll={false}
              aria-current={view === key ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 text-sm",
                view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {view === "calendar" ? (
        <ActivityCalendar entries={entries} month={from} dayHref={dayHref} />
      ) : entries.length > 0 ? (
        <ul className="flex flex-col divide-y">
          {listPage.items.map((entry) => (
            <li key={`${entry.activityId}:${entry.key}`} className="flex flex-col gap-1 py-3">
              <Link
                href={`/kegiatan/${entry.activityId}`}
                className="flex items-center justify-between gap-2 text-sm font-medium"
              >
                <span>{entry.activityName}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.effectiveDate} · {entry.effectiveStartTime}
                </span>
              </Link>
              <p className="text-xs text-muted-foreground">
                {entry.groupName} · {entry.effectiveLocation}
              </p>
              <div className="flex flex-wrap gap-1">
                {entry.inherited && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">warisan</span>
                )}
                {entry.moved && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">dipindah</span>}
                {entry.status === "CANCELLED" && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">batal</span>
                )}
                {entry.hasConflict && (
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                    konflik
                  </span>
                )}
                {entry.canRecord && (
                  <Link
                    href={`/kegiatan/${entry.activityId}/${entry.key}`}
                    className="ml-auto text-xs text-primary hover:underline"
                  >
                    Isi absensi
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {q ? "Tidak ada kegiatan yang cocok." : "Tidak ada kegiatan pada rentang ini."}
        </p>
      )}

      {view === "list" && (
        <Pagination {...listPage} hrefFor={(target) => pageHref("/kegiatan", params, target)} />
      )}
    </div>
  );
}
