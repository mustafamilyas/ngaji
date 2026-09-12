import { db } from "@/lib/db";
import { toSessionUser, type SessionUser } from "./session-user";

/**
 * Re-reads `User` + `UserGroupRole` for the given id (one PK lookup),
 * called from the `jwt` callback on every session read so a deactivation
 * or role/group change takes effect on the user's very next request,
 * without waiting for their token to expire (DESIGN.md §4.1, D3).
 */
export async function revalidateSessionUser(userId: number): Promise<SessionUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { role: { include: { group: true } } },
  });

  if (!user || !user.isActive || !user.role) return null;

  return toSessionUser({ ...user, role: user.role });
}
