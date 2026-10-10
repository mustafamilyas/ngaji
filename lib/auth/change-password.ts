import bcrypt from "bcrypt";
import { audit } from "@/lib/audit";
import { BCRYPT_COST } from "@/lib/constants";
import { db } from "@/lib/db";
import type { RequestContext } from "./audit-events";
import { withKeyedLock } from "./keyed-lock";
import { isLoginRateLimited } from "./rate-limit";

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

const NO_CONTEXT: RequestContext = { ip: null, userAgent: null };

/**
 * Verifies the current password and, on success, sets the new one, clears
 * `mustChangePassword` and bumps `sessionVersion` (ending every session of
 * this user) in the same transaction as the audit write (DESIGN.md §4.1,
 * `user.change_password`). Wrong guesses share the login limiter: they are
 * audited as `auth.login_failed` with `meta.reason = "change_password"` and
 * counted per username, so a hijacked session cannot brute-force the
 * current password.
 */
export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
  context: RequestContext = NO_CONTEXT,
): Promise<ChangePasswordResult> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { ok: false, error: "Password saat ini salah" };
  }

  return withKeyedLock([`u:${user.username}`], async () => {
    if (await isLoginRateLimited(user.username, context.ip)) {
      return { ok: false, error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      await db.$transaction((tx) =>
        audit(tx, {
          actorId: userId,
          action: "auth.login_failed",
          meta: { username: user.username, reason: "change_password" },
          ip: context.ip,
          userAgent: context.userAgent,
        }),
      );
      return { ok: false, error: "Password saat ini salah" };
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } },
      });
      await audit(tx, {
        actorId: userId,
        action: "user.change_password",
        entity: "User",
        entityId: userId,
        meta: { username: user.username },
        ip: context.ip,
        userAgent: context.userAgent,
      });
    });

    return { ok: true };
  });
}
