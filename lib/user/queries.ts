import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { resolveGroups } from "@/lib/resolve";

/**
 * Users in the caller's scope, for the `/pengguna` page and the `/audit`
 * actor filter. Filtering through the `group` relation bypasses
 * `lib/db.ts`'s soft-delete extension (that only wraps top-level
 * `group.*` calls), so `deletedAt: null` is added explicitly here.
 */
export async function listUsersInScope(session: SessionUser) {
  const roles = await db.userGroupRole.findMany({
    where: { group: { path: { startsWith: session.groupPath }, deletedAt: null } },
    include: { user: true, group: true },
    orderBy: [{ user: { name: "asc" } }],
  });
  return roles;
}

export type ListUsersFilter = {
  /** Matches name or username. */
  search?: string;
  /** Users placed in any of these groups or their descendants; default the caller's whole scope. */
  groupIds?: number[];
};

/** Filtered `/pengguna` list; same scope and soft-delete rules as `listUsersInScope`. */
export async function listUsers(session: SessionUser, filter: ListUsersFilter = {}) {
  const groupPaths =
    filter.groupIds && filter.groupIds.length > 0
      ? (await resolveGroups(session, filter.groupIds)).map((g) => g.path)
      : [session.groupPath];

  return db.userGroupRole.findMany({
    where: {
      OR: groupPaths.map((path) => ({ group: { path: { startsWith: path }, deletedAt: null } })),
      ...(filter.search
        ? { user: { OR: [{ name: { contains: filter.search } }, { username: { contains: filter.search } }] } }
        : {}),
    },
    include: { user: true, group: true },
    orderBy: [{ user: { name: "asc" } }],
  });
}
