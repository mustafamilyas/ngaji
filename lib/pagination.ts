/** Pure pagination helpers shared by server-paginated queries and in-memory lists (`components/pagination.tsx`). */

export function totalPagesFor(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** `page` limited to the pages that exist, so a stale `?page=9` shows the last page instead of an empty list. */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, Math.floor(page)), totalPagesFor(total, pageSize));
}

export type Paginated<T> = { items: T[]; page: number; pageSize: number; total: number };

/** One page of an in-memory list (lists computed rather than queried, e.g. expanded occurrences). */
export function paginate<T>(items: T[], page: number, pageSize: number): Paginated<T> {
  const current = clampPage(page, items.length, pageSize);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, pageSize, total: items.length };
}

export type PageWindowItem = number | "gap";

/**
 * Page numbers to show as buttons: always the first and last page and the
 * current page with one neighbour each side; anything else collapses into a
 * "gap", except a gap that would hide a single page (that page is shown).
 */
export function pageWindow(current: number, totalPages: number): PageWindowItem[] {
  const shown = new Set([1, totalPages, current - 1, current, current + 1]);
  const pages = [...shown].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const result: PageWindowItem[] = [];
  for (const p of pages) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && p - previous === 2) result.push(previous + 1);
    else if (typeof previous === "number" && p - previous > 2) result.push("gap");
    result.push(p);
  }
  return result;
}

/** Link to `page` of the current URL: every other param is kept; page 1 drops the param. */
export function pageHref(
  path: string,
  params: Record<string, string | string[] | undefined>,
  page: number,
  pageParam = "page",
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === pageParam || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) next.append(key, v);
  }
  if (page > 1) next.set(pageParam, String(page));
  const query = next.toString();
  return query ? `${path}?${query}` : path;
}
