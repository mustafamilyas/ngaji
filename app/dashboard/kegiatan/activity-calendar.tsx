import Link from "next/link";
import { StickyNote } from "lucide-react";
import type { ActivityListEntry } from "@/lib/activity/list";
import { addDays, monthEndOf, monthStartOf, sundayOf } from "@/lib/dates";

const WEEKDAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MAX_VISIBLE_PER_DAY = 3;

/**
 * Sunday-start month grid over the same `entries` the list view renders —
 * no second data fetch (DESIGN §5.3, D4). Tapping a day links to the list
 * view scoped to that single day.
 */
export function ActivityCalendar({
  entries,
  month,
  dayHref,
}: {
  entries: ActivityListEntry[];
  month: string;
  dayHref: (date: string) => string;
}) {
  const entriesByDate = new Map<string, ActivityListEntry[]>();
  for (const entry of entries) {
    const list = entriesByDate.get(entry.effectiveDate) ?? [];
    list.push(entry);
    entriesByDate.set(entry.effectiveDate, list);
  }

  const monthStart = monthStartOf(month);
  const monthEnd = monthEndOf(month);
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
                <div key={`${entry.activityId}:${entry.key}`} className="hidden flex-col gap-0.5 sm:flex">
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
    </div>
  );
}
