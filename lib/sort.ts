/**
 * Column sorting for list pages, held in the URL as `?sort=<key>&dir=asc|desc`.
 * The key is checked against the page's whitelist, so a client value never
 * reaches a query as-is. The default sort is never written to the URL.
 */
export type SortDir = "asc" | "desc";
export type SortState<K extends string> = { key: K; dir: SortDir };

type Params = Record<string, string | string[] | undefined>;

export function parseSort<K extends string>(params: Params, keys: readonly K[], fallback: SortState<K>): SortState<K> {
  const key = typeof params.sort === "string" && (keys as readonly string[]).includes(params.sort) ? (params.sort as K) : undefined;
  if (!key) return fallback;
  const dir: SortDir = params.dir === "desc" ? "desc" : params.dir === "asc" ? "asc" : key === fallback.key ? fallback.dir : "asc";
  return { key, dir };
}

/**
 * Link for clicking column `key`: the active column flips direction, any other
 * column starts ascending (or `firstDir`). Drops `page` — a new order starts at page 1.
 */
export function sortHref<K extends string>(
  path: string,
  params: Params,
  key: K,
  current: SortState<K>,
  fallback: SortState<K>,
  firstDir: SortDir = "asc",
): string {
  const dir: SortDir = key === current.key ? (current.dir === "asc" ? "desc" : "asc") : firstDir;
  const next = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (name === "page" || name === "sort" || name === "dir" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) next.append(name, v);
  }
  if (key !== fallback.key || dir !== fallback.dir) {
    next.set("sort", key);
    next.set("dir", dir);
  }
  const query = next.toString();
  return query ? `${path}?${query}` : path;
}

/** Hidden fields for a filter form, so changing a filter keeps the chosen order. */
export function sortPreserve<K extends string>(current: SortState<K>, fallback: SortState<K>) {
  return current.key === fallback.key && current.dir === fallback.dir
    ? {}
    : { sort: current.key as string, dir: current.dir as string };
}

/** Comparator for in-memory lists (Indonesian collation for text). */
export function compareValues(a: string | number | null | undefined, b: string | number | null | undefined, dir: SortDir): number {
  // Empty values always sort last, whichever the direction.
  if (a == null || a === "") return b == null || b === "" ? 0 : 1;
  if (b == null || b === "") return -1;
  const cmp = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "id-ID");
  return dir === "asc" ? cmp : -cmp;
}
