import { db } from "@/lib/db";
import {
  LOGIN_RATE_LIMIT_MAX_PER_IP,
  LOGIN_RATE_LIMIT_MAX_PER_USERNAME,
  LOGIN_RATE_LIMIT_WINDOW_MINUTES,
} from "@/lib/constants";

/**
 * Refuses a login attempt when, in the last 15 minutes, there are ≥ 5
 * `auth.login_failed` entries for the same username or ≥ 20 for the same IP
 * (DESIGN.md §4.1). Computed from `AuditLog` directly; no separate store.
 * SQLite's Prisma provider has no JSON-path filtering, so the window's rows
 * are counted in application code rather than in the query.
 */
export async function isLoginRateLimited(
  username: string | null,
  ip: string | null,
): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60_000);
  const rows = await db.auditLog.findMany({
    where: { action: "auth.login_failed", createdAt: { gte: since } },
    select: { meta: true, ip: true },
  });

  if (username) {
    const usernameCount = rows.filter(
      (row) => (row.meta as { username?: string } | null)?.username === username,
    ).length;
    if (usernameCount >= LOGIN_RATE_LIMIT_MAX_PER_USERNAME) return true;
  }

  if (ip) {
    const ipCount = rows.filter((row) => row.ip === ip).length;
    if (ipCount >= LOGIN_RATE_LIMIT_MAX_PER_IP) return true;
  }

  return false;
}
