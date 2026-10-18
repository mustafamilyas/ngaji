import type { ActivityListEntry } from "@/lib/activity/list";

/** `HH:mm` end time for a start time plus a duration; wraps past midnight. */
export function endTimeOf(start: string, durationMinutes: number): string {
  const [hours, minutes] = start.split(":").map(Number);
  const total = (hours * 60 + minutes + durationMinutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Entries grouped under their effective date (ascending). Within a date they are
 * ordered by effective start time, then activity name. Dates with no remaining
 * entry are omitted.
 */
export function groupScheduleByDate(
  entries: ActivityListEntry[],
  { showCancelled }: { showCancelled: boolean },
): { date: string; entries: ActivityListEntry[] }[] {
  const byDate = new Map<string, ActivityListEntry[]>();
  for (const entry of entries) {
    if (!showCancelled && entry.status === "CANCELLED") continue;
    const list = byDate.get(entry.effectiveDate);
    if (list) list.push(entry);
    else byDate.set(entry.effectiveDate, [entry]);
  }
  return [...byDate.keys()]
    .sort()
    .map((date) => ({
      date,
      entries: byDate
        .get(date)!
        .sort(
          (a, b) =>
            a.effectiveStartTime.localeCompare(b.effectiveStartTime) ||
            a.activityName.localeCompare(b.activityName, "id-ID"),
        ),
    }));
}
