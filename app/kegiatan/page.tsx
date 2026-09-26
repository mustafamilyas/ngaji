import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ActivityCalendar } from "./activity-calendar";
import { FilterForm } from "./filter-form";
import { listActivityOccurrences } from "@/lib/activity/list";
import { visibleGroupsWhere } from "@/lib/authz";
import { db } from "@/lib/db";
import { addDays, addMonthsOnDay, monthStartOf, rangeForMode, sundayOf, today, type RangeMode } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";

const RANGE_MODES: RangeMode[] = ["hari", "minggu", "bulan"];

function parseGroupIds(param: string | string[] | undefined): number[] | undefined {
  const raw = typeof param === "string" ? param : Array.isArray(param) ? param[0] : undefined;
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n));
  return ids.length > 0 ? ids : undefined;
}

function shiftAnchor(mode: RangeMode, anchor: string, direction: 1 | -1): string {
  switch (mode) {
    case "hari":
      return addDays(anchor, direction);
    case "minggu":
      return addDays(anchor, direction * 7);
    case "bulan":
      return addMonthsOnDay(monthStartOf(anchor), direction, 1)!;
  }
}

export default async function ActivityListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;

  const rangeParam = typeof params.range === "string" ? params.range : "minggu";
  const range: RangeMode | "custom" = [...RANGE_MODES, "custom"].includes(rangeParam)
    ? (rangeParam as RangeMode | "custom")
    : "minggu";

  const anchor = typeof params.anchor === "string" ? params.anchor : today();

  const defaultFrom = sundayOf(today());
  const defaultTo = addDays(defaultFrom, 6);
  const { from, to } =
    range === "custom"
      ? {
          from: typeof params.from === "string" ? params.from : defaultFrom,
          to: typeof params.to === "string" ? params.to : defaultTo,
        }
      : rangeForMode(range, anchor);

  const view = params.view === "calendar" ? "calendar" : "list";

  const groupIds = parseGroupIds(params.grup);

  const [{ entries, groups }, visibleGroups] = await Promise.all([
    (async () => {
      try {
        return await listActivityOccurrences(session.user, { from, to, groupIds });
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

  const groupsLabel = groups.length === 1 ? groups[0].name : `${groups.length} grup`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Kegiatan</h1>
        <Link href="/kegiatan/baru" className="text-sm text-primary hover:underline">
          Kegiatan baru
        </Link>
      </div>

      <FilterForm
        groups={visibleGroups}
        initialSelectedGroupIds={groupIds ?? [session.user.groupId]}
        range={range}
        anchor={anchor}
        from={from}
        to={to}
        view={view}
      />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {range === "custom" ? (
          <span />
        ) : (
          <Link href={hrefWith({ anchor: shiftAnchor(range, anchor, -1) })} className="text-primary hover:underline">
            Sebelumnya
          </Link>
        )}
        <span>
          {from} – {to} · {groupsLabel}
        </span>
        {range === "custom" ? (
          <span />
        ) : (
          <Link href={hrefWith({ anchor: shiftAnchor(range, anchor, 1) })} className="text-primary hover:underline">
            Berikutnya
          </Link>
        )}
      </div>

      <div className="flex gap-2 text-sm">
        <Link
          href={hrefWith({ view: "list" })}
          className={view === "list" ? "font-medium text-primary" : "text-muted-foreground hover:underline"}
        >
          Daftar
        </Link>
        <Link
          href={hrefWith({ view: "calendar" })}
          className={view === "calendar" ? "font-medium text-primary" : "text-muted-foreground hover:underline"}
        >
          Kalender
        </Link>
      </div>

      {view === "calendar" ? (
        <ActivityCalendar entries={entries} month={from} dayHref={dayHref} />
      ) : entries.length > 0 ? (
        <ul className="flex flex-col divide-y">
          {entries.map((entry) => (
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
        <p className="text-sm text-muted-foreground">Tidak ada kegiatan pada rentang ini.</p>
      )}
    </div>
  );
}
