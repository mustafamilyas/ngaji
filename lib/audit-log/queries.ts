import type { SessionUser } from "@/lib/auth/session-user";
import { visibleGroupsWhere } from "@/lib/authz";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { clampPage } from "@/lib/pagination";
import { resolveGroups } from "@/lib/resolve";
import type { SortState } from "@/lib/sort";

/** Sortable `/dashboard/audit` columns → the field they order by. */
const AUDIT_SORT_FIELDS = {
  waktu: (dir) => ({ createdAt: dir }),
  aksi: (dir) => ({ action: dir }),
  aktor: (dir) => ({ actor: { name: dir } }),
  entitas: (dir) => ({ entity: dir }),
} satisfies Record<string, (dir: "asc" | "desc") => object>;

export type AuditSortKey = keyof typeof AUDIT_SORT_FIELDS;
export const AUDIT_SORT_KEYS = Object.keys(AUDIT_SORT_FIELDS) as AuditSortKey[];
export const DEFAULT_AUDIT_SORT: SortState<AuditSortKey> = { key: "waktu", dir: "desc" };

export type AuditLogFilter = {
  page?: number;
  action?: string;
  actorId?: number;
  /** YYYY-MM-DD, inclusive, interpreted in Asia/Jakarta. */
  from?: string;
  /** YYYY-MM-DD, inclusive, interpreted in Asia/Jakarta. */
  to?: string;
  /** Only entries scoped to these groups or their descendants (drops group-less `auth.*` entries). */
  groupIds?: number[];
  sort?: SortState<AuditSortKey>;
};

const JAKARTA_UTC_OFFSET = "+07:00";

function startOfDayJakarta(date: string): Date {
  return new Date(`${date}T00:00:00${JAKARTA_UTC_OFFSET}`);
}

function endOfDayJakarta(date: string): Date {
  return new Date(`${date}T23:59:59.999${JAKARTA_UTC_OFFSET}`);
}

/**
 * `/dashboard/audit` viewer query (audit-log spec "Viewer"): OWNER only, entries
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

  const selectedGroups =
    filter.groupIds && filter.groupIds.length > 0 ? await resolveGroups(session, filter.groupIds) : undefined;

  const scopedGroups = await db.group.findMany({
    where: selectedGroups
      ? { OR: selectedGroups.map((g) => ({ path: { startsWith: g.path } })) }
      : visibleGroupsWhere(session),
    select: { id: true },
  });
  const groupIds = scopedGroups.map((g) => g.id);

  const where = {
    OR: selectedGroups
      ? [{ groupId: { in: groupIds } }]
      : [{ groupId: { in: groupIds } }, { groupId: null, actorId: Number(session.id) }],
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

  const total = await db.auditLog.count({ where });
  const page = clampPage(filter.page ?? 1, total, PAGE_SIZE);
  const entries = await db.auditLog.findMany({
    where,
    include: { actor: { select: { id: true, name: true, username: true } } },
    orderBy: [
      AUDIT_SORT_FIELDS[(filter.sort ?? DEFAULT_AUDIT_SORT).key]((filter.sort ?? DEFAULT_AUDIT_SORT).dir),
      { createdAt: "desc" as const },
      { id: "desc" as const },
    ],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return { entries, total, page, pageSize: PAGE_SIZE };
}
