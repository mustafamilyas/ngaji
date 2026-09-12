import bcrypt from "bcrypt";
import { audit } from "@/lib/audit";
import { BCRYPT_COST } from "@/lib/constants";
import { db } from "@/lib/db";

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

/**
 * Verifies the current password and, on success, sets the new one and
 * clears `mustChangePassword` in the same transaction as the audit write
 * (DESIGN.md §4.1, `user.change_password`).
 */
export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { ok: false, error: "Password saat ini salah" };
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "Password saat ini salah" };
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    await audit(tx, {
      actorId: userId,
      action: "user.change_password",
      entity: "User",
      entityId: userId,
      meta: { username: user.username },
    });
  });

  return { ok: true };
}
