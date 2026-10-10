import { db } from "@/lib/db";
import {
  LOGIN_RATE_LIMIT_MAX_PER_IP,
  LOGIN_RATE_LIMIT_MAX_PER_USERNAME,
  LOGIN_RATE_LIMIT_WINDOW_MINUTES,
} from "@/lib/constants";

/**
 * Refuses a login attempt when, in the last 15 minutes, there are ≥ 5
 * `auth.login_failed` entries for the same (normalized) username or ≥ 20 for
 * the same IP (DESIGN.md §4.1). Counted in SQL from `AuditLog` — no separate
 * store. The username lives in `meta`, which Prisma can't filter on for
 * SQLite, hence `json_extract` in a raw query.
 *
 * The check and the failure audit that follows must run under
 * `withKeyedLock` (see `login.ts`), otherwise parallel attempts all pass
 * the check before any of them records a failure.
 */
export async function isLoginRateLimited(
  username: string | null,
  ip: string | null,
): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60_000);

  if (username) {
    const rows = await db.$queryRaw<Array<{ n: number | bigint }>>`
      SELECT COUNT(*) AS n FROM "AuditLog"
      WHERE "action" = 'auth.login_failed'
        AND "createdAt" >= ${since}
        AND json_extract("meta", '$.username') = ${username}`;
    if (Number(rows[0]?.n ?? 0) >= LOGIN_RATE_LIMIT_MAX_PER_USERNAME) return true;
  }

  if (ip) {
    const ipCount = await db.auditLog.count({
      where: { action: "auth.login_failed", ip, createdAt: { gte: since } },
    });
    if (ipCount >= LOGIN_RATE_LIMIT_MAX_PER_IP) return true;
  }

  return false;
}
