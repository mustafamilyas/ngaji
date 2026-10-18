import type { SessionUser } from "@/lib/auth/session-user";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { clampPage } from "@/lib/pagination";
import { resolveGroups } from "@/lib/resolve";
import type { SortState } from "@/lib/sort";

/** Sortable `/dashboard/pengguna` columns → the field they order by. */
const USER_SORT_FIELDS = {
  nama: (dir) => ({ user: { name: dir } }),
  username: (dir) => ({ user: { username: dir } }),
  peran: (dir) => ({ role: dir }),
  grup: (dir) => ({ group: { name: dir } }),
  status: (dir) => ({ user: { isActive: dir } }),
} satisfies Record<string, (dir: "asc" | "desc") => object>;

export type UserSortKey = keyof typeof USER_SORT_FIELDS;
export const USER_SORT_KEYS = Object.keys(USER_SORT_FIELDS) as UserSortKey[];
export const DEFAULT_USER_SORT: SortState<UserSortKey> = { key: "nama", dir: "asc" };

/**
 * Users in the caller's scope, for the `/dashboard/pengguna` page and the `/dashboard/audit`
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
  page?: number;
  sort?: SortState<UserSortKey>;
};

/** Filtered, paginated `/dashboard/pengguna` list; same scope and soft-delete rules as `listUsersInScope`. */
export async function listUsers(session: SessionUser, filter: ListUsersFilter = {}) {
  const groupPaths =
    filter.groupIds && filter.groupIds.length > 0
      ? (await resolveGroups(session, filter.groupIds)).map((g) => g.path)
      : [session.groupPath];

  const where = {
    OR: groupPaths.map((path) => ({ group: { path: { startsWith: path }, deletedAt: null } })),
    ...(filter.search
      ? { user: { OR: [{ name: { contains: filter.search } }, { username: { contains: filter.search } }] } }
      : {}),
  };

  const total = await db.userGroupRole.count({ where });
  const page = clampPage(filter.page ?? 1, total, PAGE_SIZE);
  const roles = await db.userGroupRole.findMany({
    where,
    include: { user: true, group: true },
    orderBy: [
      USER_SORT_FIELDS[(filter.sort ?? DEFAULT_USER_SORT).key]((filter.sort ?? DEFAULT_USER_SORT).dir),
      { user: { name: "asc" as const } },
      { id: "asc" as const },
    ],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return { roles, total, page, pageSize: PAGE_SIZE };
}
