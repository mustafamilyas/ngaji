import { compareValues, type SortState } from "@/lib/sort";

type SortableEntry = {
  activityName: string;
  groupName: string;
  effectiveDate: string;
  effectiveStartTime: string;
  effectiveLocation: string;
};

export const ACTIVITY_SORT_KEYS = ["tanggal", "kegiatan", "grup", "lokasi"] as const;
export type ActivitySortKey = (typeof ACTIVITY_SORT_KEYS)[number];
export const DEFAULT_ACTIVITY_SORT: SortState<ActivitySortKey> = { key: "tanggal", dir: "asc" };

const VALUE: Record<ActivitySortKey, (e: SortableEntry) => string> = {
  tanggal: (e) => `${e.effectiveDate} ${e.effectiveStartTime}`,
  kegiatan: (e) => e.activityName,
  grup: (e) => e.groupName,
  lokasi: (e) => e.effectiveLocation,
};

/** `/dashboard/kegiatan` list order (the list is built in memory); ties fall back to date then time. */
export function sortActivityEntries<T extends SortableEntry>(entries: T[], sort: SortState<ActivitySortKey>): T[] {
  return [...entries].sort(
    (a, b) =>
      compareValues(VALUE[sort.key](a), VALUE[sort.key](b), sort.dir) ||
      compareValues(VALUE.tanggal(a), VALUE.tanggal(b), "asc"),
  );
}
