import bcrypt from "bcrypt";
import { audit } from "@/lib/audit";
import { BCRYPT_COST } from "@/lib/constants";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { generateTemporaryPassword } from "./mutations";

/**
 * Emergency OWNER recovery (user-management spec): runs only from a shell on
 * the server via `scripts/reset-owner-password.ts`, never from an HTTP route.
 * Restricted to OWNER accounts so it cannot double as a general password
 * backdoor; ADMIN/USER are reset in the app by their OWNER.
 */
export async function resetOwnerPassword(
  username: string,
  { activate }: { activate: boolean },
): Promise<{ temporaryPassword: string }> {
  const user = await db.user.findUnique({
    where: { username: username.trim() },
    include: { role: true },
  });
  if (!user || user.role?.role !== "OWNER") {
    // One message for both cases: the CLI must not reveal non-OWNER usernames either.
    throw new ValidationError(`Tidak ada OWNER dengan username "${username}"`);
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST);
  const activated = activate && !user.isActive;

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        sessionVersion: { increment: 1 },
        ...(activated ? { isActive: true } : {}),
      },
    });
    await audit(tx, {
      actorId: null,
      action: "user.reset_password",
      entity: "User",
      entityId: user.id,
      groupId: user.role?.groupId,
      meta: { username: user.username, via: "cli", activated },
    });
  });

  return { temporaryPassword };
}
