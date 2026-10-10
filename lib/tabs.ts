/**
 * Detail-page tabs live in the URL (`?tab=`) so a tab is shareable, works
 * without JS and survives a reload. The default tab is never written to the
 * URL; an unknown or missing value falls back to it.
 */
export function parseTab<T extends string>(
  value: string | string[] | undefined,
  tabs: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (tabs as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Link to `tab` on `path`. Other query params (paging, filters) belong to the tab being left, so they are dropped. */
export function tabHref(path: string, tab: string, defaultTab: string): string {
  return tab === defaultTab ? path : `${path}?tab=${encodeURIComponent(tab)}`;
}
