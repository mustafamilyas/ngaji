const PUBLIC_PATHS: ReadonlySet<string> = new Set(["/", "/ormas", "/daftar", "/login"]);

/**
 * Routes reachable without a session. Exact match only: no prefix or
 * normalization, so `/ormas/1`, `/Login` or `/login/../anggota` stay protected.
 */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}
