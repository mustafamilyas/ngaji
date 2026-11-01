/**
 * Column sorting for list pages, held in the URL as `?sort=<key>&dir=asc|desc`.
 * The key is checked against the page's whitelist, so a client value never
 * reaches a query as-is. The default sort is never written to the URL.
 */
export type SortDir = "asc" | "desc";
export type SortState<K extends string> = { key: K; dir: SortDir };

type Params = Record<string, string | string[] | undefined>;

/**
 * Query param names of one sortable list. Pages with a single list use the defaults; a page with two
 * (the activity Absensi tab) gives each its own so sorting one keeps the order and page of the other.
 */
export type SortParams = { sort: string; dir: string; page: string };
export const DEFAULT_SORT_PARAMS: SortParams = { sort: "sort", dir: "dir", page: "page" };

export function parseSort<K extends string>(
  params: Params,
  keys: readonly K[],
  fallback: SortState<K>,
  names: SortParams = DEFAULT_SORT_PARAMS,
): SortState<K> {
  const raw = params[names.sort];
  const key = typeof raw === "string" && (keys as readonly string[]).includes(raw) ? (raw as K) : undefined;
  if (!key) return fallback;
  const rawDir = params[names.dir];
  const dir: SortDir = rawDir === "desc" ? "desc" : rawDir === "asc" ? "asc" : key === fallback.key ? fallback.dir : "asc";
  return { key, dir };
}

/**
 * Link for clicking column `key`: the active column flips direction, any other
 * column starts ascending (or `firstDir`). Drops the list's own page param — a new order starts at page 1.
 */
export function sortHref<K extends string>(
  path: string,
  params: Params,
  key: K,
  current: SortState<K>,
  fallback: SortState<K>,
  firstDir: SortDir = "asc",
  names: SortParams = DEFAULT_SORT_PARAMS,
): string {
  const dir: SortDir = key === current.key ? (current.dir === "asc" ? "desc" : "asc") : firstDir;
  const next = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (name === names.page || name === names.sort || name === names.dir || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) next.append(name, v);
  }
  if (key !== fallback.key || dir !== fallback.dir) {
    next.set(names.sort, key);
    next.set(names.dir, dir);
  }
  const query = next.toString();
  return query ? `${path}?${query}` : path;
}

/** Hidden fields for a filter form, so changing a filter keeps the chosen order. */
export function sortPreserve<K extends string>(
  current: SortState<K>,
  fallback: SortState<K>,
  names: SortParams = DEFAULT_SORT_PARAMS,
): Record<string, string> {
  return current.key === fallback.key && current.dir === fallback.dir
    ? {}
    : { [names.sort]: current.key, [names.dir]: current.dir };
}

/** Comparator for in-memory lists (Indonesian collation for text). */
export function compareValues(a: string | number | null | undefined, b: string | number | null | undefined, dir: SortDir): number {
  // Empty values always sort last, whichever the direction.
  if (a == null || a === "") return b == null || b === "" ? 0 : 1;
  if (b == null || b === "") return -1;
  const cmp = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "id-ID");
  return dir === "asc" ? cmp : -cmp;
}

/** Participation table (Statistik → Partisipasi, activity Absensi tab): one row per member. */
export const PARTICIPATION_SORT_KEYS = ["nama", "occurrence", "hadir", "izin", "persen"] as const;
export type ParticipationSortKey = (typeof PARTICIPATION_SORT_KEYS)[number];
export const DEFAULT_PARTICIPATION_SORT: SortState<ParticipationSortKey> = { key: "persen", dir: "desc" };

type SortableParticipation = { memberId: number; memberName: string; occurrenceCount: number; hadir: number; izin: number; percentHadir: number };

const PARTICIPATION_VALUE: Record<ParticipationSortKey, (r: SortableParticipation) => string | number> = {
  nama: (r) => r.memberName,
  occurrence: (r) => r.occurrenceCount,
  hadir: (r) => r.hadir,
  izin: (r) => r.izin,
  persen: (r) => r.percentHadir,
};

/** Ties fall back to name then id (whatever the direction), so a page boundary never reshuffles between requests. */
export function sortParticipation<T extends SortableParticipation>(rows: T[], sort: SortState<ParticipationSortKey>): T[] {
  return [...rows].sort(
    (a, b) =>
      compareValues(PARTICIPATION_VALUE[sort.key](a), PARTICIPATION_VALUE[sort.key](b), sort.dir) ||
      compareValues(a.memberName, b.memberName, "asc") ||
      a.memberId - b.memberId,
  );
}

/** Per-occurrence table of one activity's Absensi tab. */
export const OCCURRENCE_SORT_KEYS = ["tanggal", "hadir", "izin", "tidakHadir", "expected", "persen"] as const;
export type OccurrenceSortKey = (typeof OCCURRENCE_SORT_KEYS)[number];
export const DEFAULT_OCCURRENCE_SORT: SortState<OccurrenceSortKey> = { key: "tanggal", dir: "desc" };

type SortableOccurrence = { key: string; effectiveDate: string; expected: number; hadir: number; izin: number; absent: number; percentHadir: number };

const OCCURRENCE_VALUE: Record<OccurrenceSortKey, (o: SortableOccurrence) => string | number> = {
  tanggal: (o) => o.effectiveDate,
  hadir: (o) => o.hadir,
  izin: (o) => o.izin,
  tidakHadir: (o) => o.absent,
  expected: (o) => o.expected,
  persen: (o) => o.percentHadir,
};

/** Ties fall back to the newest effective date, then the (unique) rule date key. */
export function sortOccurrences<T extends SortableOccurrence>(rows: T[], sort: SortState<OccurrenceSortKey>): T[] {
  return [...rows].sort(
    (a, b) =>
      compareValues(OCCURRENCE_VALUE[sort.key](a), OCCURRENCE_VALUE[sort.key](b), sort.dir) ||
      compareValues(a.effectiveDate, b.effectiveDate, "desc") ||
      compareValues(a.key, b.key, "asc"),
  );
}
