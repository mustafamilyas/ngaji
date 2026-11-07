import Link from "next/link";
import { StickyNote } from "lucide-react";
import type { ActivityListEntry } from "@/lib/activity/list";
import { OccurrenceNotes } from "./occurrence-notes";
import { Badge } from "@/components/ui/badge";
import { WEEKDAY_LABELS as WEEKDAY_NAMES } from "@/lib/activity/labels";
import { addDays, daysBetween, sundayOf, weekdayOf } from "@/lib/dates";
import { formatDate } from "@/lib/filters";

const WEEKDAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MAX_VISIBLE_PER_DAY = 3;
/** Ranges up to this many days (a day or a week) read as an agenda; longer ones as a month grid. */
const AGENDA_MAX_DAYS = 7;

function groupByDate(entries: ActivityListEntry[]) {
  const byDate = new Map<string, ActivityListEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.effectiveDate) ?? [];
    list.push(entry);
    byDate.set(entry.effectiveDate, list);
  }
  for (const list of byDate.values()) list.sort((a, b) => a.effectiveStartTime.localeCompare(b.effectiveStartTime));
  return byDate;
}

/**
 * Day-by-day schedule for a short range: every occurrence in full (time, name, group,
 * location, badges, notes) and linked to its activity, which a month grid has no room for.
 */
function ActivityAgenda({
  entries,
  from,
  to,
  today,
  dayHref,
}: {
  entries: ActivityListEntry[];
  from: string;
  to: string;
  today: string;
  dayHref: (date: string) => string;
}) {
  const byDate = groupByDate(entries);
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);

  return (
    <ol className="flex flex-col divide-y rounded-md border">
      {days.map((date) => {
        const dayEntries = byDate.get(date) ?? [];
        const isToday = date === today;
        return (
          <li key={date} className={`flex flex-col gap-2 p-3 md:flex-row md:gap-6 ${isToday ? "bg-primary/5" : ""}`}>
            <div className="flex shrink-0 items-center gap-2 md:w-44 md:flex-col md:items-start md:gap-1">
              <Link href={dayHref(date)} className="inline-flex min-h-11 items-center text-sm font-medium hover:underline xl:min-h-0">
                {WEEKDAY_NAMES[weekdayOf(date)]}, {formatDate(date)}
              </Link>
              {isToday && <Badge>Hari ini</Badge>}
            </div>
            {dayEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground md:py-2.5">Tidak ada kegiatan.</p>
            ) : (
              <ul className="flex min-w-0 flex-1 flex-col gap-2">
                {dayEntries.map((entry) => {
                  const cancelled = entry.status === "CANCELLED";
                  return (
                    <li
                      key={`${entry.activityId}:${entry.key}`}
                      className={`flex gap-3 rounded-md border p-2.5 ${entry.hasConflict ? "border-destructive/40" : ""}`}
                    >
                      <span className="w-12 shrink-0 text-sm font-medium tabular-nums">{entry.effectiveStartTime}</span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/dashboard/kegiatan/${entry.activityId}`}
                          className={`inline-flex min-h-11 items-center font-medium hover:underline xl:min-h-0 ${
                            cancelled ? "text-muted-foreground line-through" : ""
                          }`}
                        >
                          {entry.activityName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {entry.groupName} · {entry.effectiveLocation} · {entry.effectiveDurationMinutes} mnt
                        </p>
                        <span className="mt-0.5 flex flex-wrap gap-1 empty:hidden">
                          {entry.inherited && <Badge variant="secondary">Warisan</Badge>}
                          {entry.moved && <Badge variant="outline">Dipindah</Badge>}
                          {cancelled && <Badge variant="destructive">Batal</Badge>}
                          {entry.hasConflict && (
                            <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Konflik</Badge>
                          )}
                        </span>
                        <OccurrenceNotes notes={entry.effectiveNotes} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Calendar over the same `entries` the list view renders — no second data fetch
 * (DESIGN §5.3, D4). A day or a week is an agenda with every occurrence in full;
 * longer ranges are a Sunday-start grid covering `from`..`to`, where tapping a day
 * links to the list view scoped to that single day.
 */
export function ActivityCalendar({
  entries,
  from,
  to,
  today,
  dayHref,
}: {
  entries: ActivityListEntry[];
  from: string;
  to: string;
  today: string;
  dayHref: (date: string) => string;
}) {
  if (daysBetween(from, to) < AGENDA_MAX_DAYS) {
    return <ActivityAgenda entries={entries} from={from} to={to} today={today} dayHref={dayHref} />;
  }

  const entriesByDate = groupByDate(entries);

  const monthStart = from;
  const monthEnd = to;
  const gridStart = sundayOf(monthStart);
  const gridEnd = addDays(sundayOf(monthEnd), 6);

  const days: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    days.push(d);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {days.map((date) => {
          const dayEntries = entriesByDate.get(date) ?? [];
          const inMonth = date >= monthStart && date <= monthEnd;
          const visible = dayEntries.slice(0, MAX_VISIBLE_PER_DAY);
          const overflow = dayEntries.length - visible.length;

          return (
            <Link
              key={date}
              href={dayHref(date)}
              className={`flex min-h-16 flex-col gap-0.5 rounded-md border p-1 text-left ${
                inMonth ? "bg-background" : "bg-muted/40 text-muted-foreground"
              }`}
            >
              <span className="text-xs font-medium">{Number(date.slice(-2))}</span>
              {/* Phones: cells are about 45px wide, so show one dot per occurrence and open the day for the text. */}
              {dayEntries.length > 0 && (
                <span data-day-dots className="mt-0.5 flex flex-wrap items-center gap-0.5 sm:hidden">
                  {visible.map((entry) => (
                    <span
                      key={`${entry.activityId}:${entry.key}`}
                      aria-hidden="true"
                      className={`size-1.5 rounded-full ${
                        entry.status === "CANCELLED"
                          ? "bg-muted-foreground/40"
                          : entry.hasConflict
                            ? "bg-destructive"
                            : "bg-primary"
                      }`}
                    />
                  ))}
                  {visible.some((entry) => entry.effectiveNotes) && (
                    <StickyNote data-notes-marker aria-hidden="true" className="size-2.5 text-muted-foreground" />
                  )}
                </span>
              )}
              {visible.map((entry) => (
                // Dense month grid: tapping the cell opens the day's full list, so the cell text may stay small.
                <div key={`${entry.activityId}:${entry.key}`} data-small-text-ok className="hidden flex-col gap-0.5 sm:flex">
                  <span className="truncate text-[10px] leading-tight">
                    {entry.effectiveStartTime} {entry.activityName}
                  </span>
                  {entry.effectiveNotes && (
                    <span
                      data-occurrence-notes
                      title={entry.effectiveNotes}
                      className="truncate text-[9px] leading-tight text-muted-foreground"
                    >
                      {entry.effectiveNotes}
                    </span>
                  )}
                  {(entry.inherited || entry.moved || entry.hasConflict || entry.status === "CANCELLED") && (
                    <div className="flex flex-wrap gap-0.5">
                      {entry.inherited && (
                        <span className="rounded-full bg-muted px-1 text-[9px] leading-tight">warisan</span>
                      )}
                      {entry.moved && <span className="rounded-full bg-muted px-1 text-[9px] leading-tight">dipindah</span>}
                      {entry.status === "CANCELLED" && (
                        <span className="rounded-full bg-muted px-1 text-[9px] leading-tight">batal</span>
                      )}
                      {entry.hasConflict && (
                        <span className="rounded-full bg-destructive/15 px-1 text-[9px] leading-tight text-destructive">
                          konflik
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {overflow > 0 && <span className="hidden text-[9px] text-muted-foreground sm:block">+{overflow} lagi</span>}
            </Link>
          );
        })}
      </div>
      {/* Phones only: the day cells show dots instead of text, so say what they mean. */}
      <p data-calendar-legend className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:hidden">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-primary" /> Jadwal
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-destructive" /> Konflik
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-muted-foreground/40" /> Batal
        </span>
        <span className="inline-flex items-center gap-1">
          <StickyNote aria-hidden className="size-3" /> Ada keterangan
        </span>
      </p>
    </div>
  );
}
