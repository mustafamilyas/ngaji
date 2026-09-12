/**
 * Materialized-path scope comparisons (DESIGN.md §2, §3.1). `path` always
 * includes the group's own id and a trailing slash ("1/5/12/") so that a
 * numeric-prefix collision like "1/5/" vs "1/50/" can never false-match.
 */

/** `true` if `path` is `scopePath` itself or one of its descendants. */
export function isInScope(path: string, scopePath: string): boolean {
  return path.startsWith(scopePath);
}

/** `true` if `path` is a strict ancestor of `ofPath` (a prefix, not equal to it). */
export function isAncestorOf(path: string, ofPath: string): boolean {
  return path !== ofPath && ofPath.startsWith(path);
}

/** Every ancestor path of `path`, inclusive of `path` itself: "1/5/12/" -> ["1/", "1/5/", "1/5/12/"]. */
export function ancestorPathsOf(path: string): string[] {
  const segments = path.split("/").filter(Boolean);
  const prefixes: string[] = [];
  let acc = "";
  for (const segment of segments) {
    acc += `${segment}/`;
    prefixes.push(acc);
  }
  return prefixes;
}
