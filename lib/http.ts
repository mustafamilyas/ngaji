/**
 * Client IP as set by the reverse proxy. Nginx overwrites `X-Forwarded-For`
 * with `$remote_addr`, so the last hop is the only entry the proxy vouches
 * for; earlier entries are client-supplied and ignored. Falls back to
 * `X-Real-IP`; null if neither is present.
 */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const lastHop = forwarded?.split(",").at(-1)?.trim();
  if (lastHop) return lastHop;
  return request.headers.get("x-real-ip")?.trim() || null;
}
