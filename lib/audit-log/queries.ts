import type { SessionUser } from "@/lib/auth/session-user";
import { visibleGroupsWhere } from "@/lib/authz";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

export type AuditLogFilter = {
  page?: number;
  action?: string;
  actorId?: number;
  /** YYYY-MM-DD, inclusive, interpreted in Asia/Jakarta. */
  from?: string;
  /** YYYY-MM-DD, inclusive, interpreted in Asia/Jakarta. */
  to?: string;
};

const JAKARTA_UTC_OFFSET = "+07:00";

function startOfDayJakarta(date: string): Date {
  return new Date(`${date}T00:00:00${JAKARTA_UTC_OFFSET}`);
}

function endOfDayJakarta(date: string): Date {
  return new Date(`${date}T23:59:59.999${JAKARTA_UTC_OFFSET}`);
}

/**
 * `/audit` viewer query (audit-log spec "Viewer"): OWNER only, entries
 * whose `groupId` is in scope plus the caller's own `auth.*` entries
 * (those carry `groupId = null`, per `lib/auth/audit-events.ts`).
 *
 * Non-OWNER callers get `NotFoundError` (404), not the generic
 * `authorize()` 403 — the audit-log spec's "ADMIN denied" scenario is
 * explicit that the page itself must not be revealed to exist.
 *
 * `AuditLog.groupId` is a plain scoping column with no Prisma relation to
 * `Group` (DESIGN.md §2), so scope is resolved as an explicit id list
 * rather than a relation filter.
 */
export async function listAuditLog(session: SessionUser, filter: AuditLogFilter = {}) {
  if (session.role !== "OWNER") throw new NotFoundError();

  const page = filter.page && filter.page > 0 ? Math.floor(filter.page) : 1;

  const scopedGroups = await db.group.findMany({
    where: visibleGroupsWhere(session),
    select: { id: true },
  });
  const groupIds = scopedGroups.map((g) => g.id);

  const where = {
    OR: [{ groupId: { in: groupIds } }, { groupId: null, actorId: Number(session.id) }],
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.actorId ? { actorId: filter.actorId } : {}),
    ...(filter.from || filter.to
      ? {
          createdAt: {
            ...(filter.from ? { gte: startOfDayJakarta(filter.from) } : {}),
            ...(filter.to ? { lte: endOfDayJakarta(filter.to) } : {}),
          },
        }
      : {}),
  };

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, name: true, username: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
  ]);

  return { entries, total, page, pageSize: PAGE_SIZE };
}
