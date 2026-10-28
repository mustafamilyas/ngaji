import { db } from "@/lib/db";
import { toSessionUser, type SessionUser } from "./session-user";

/**
 * Re-reads `User` + `UserGroupRole` for the given id (one PK lookup),
 * called from the `jwt` callback on every session read so a deactivation
 * or role/group change takes effect on the user's very next request,
 * without waiting for their token to expire (DESIGN.md §4.1, D3). A
 * `sessionVersion` that differs from the stored one (password changed or
 * reset) also drops the session.
 */
export async function revalidateSessionUser(
  userId: number,
  tokenSessionVersion: number | undefined,
): Promise<SessionUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { role: { include: { group: { include: { organization: true } } } }, extraRoles: true },
  });

  if (!user || !user.isActive || !user.role) return null;
  // A token without a version (issued before this existed) never matches.
  if (tokenSessionVersion !== user.sessionVersion) return null;

  return toSessionUser({ ...user, role: user.role });
}
