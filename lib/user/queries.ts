import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";

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
