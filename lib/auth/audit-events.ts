import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import type { CredentialsResult } from "./credentials";

export type RequestContext = { ip: string | null; userAgent: string | null };

/** Writes `auth.login` on success or `auth.login_failed` on failure (DESIGN.md §4.5). */
export async function auditLoginAttempt(
  result: CredentialsResult,
  context: RequestContext,
): Promise<void> {
  if (result.ok) {
    await db.$transaction((tx) =>
      audit(tx, {
        actorId: Number(result.user.id),
        action: "auth.login",
        meta: { username: result.user.username },
        ip: context.ip,
        userAgent: context.userAgent,
      }),
    );
    return;
  }

  await db.$transaction((tx) =>
    audit(tx, {
      actorId: result.actorId,
      action: "auth.login_failed",
      meta: { username: result.username },
      ip: context.ip,
      userAgent: context.userAgent,
    }),
  );
}

export async function auditLogout(userId: number, username: string): Promise<void> {
  await db.$transaction((tx) =>
    audit(tx, {
      actorId: userId,
      action: "auth.logout",
      meta: { username },
    }),
  );
}
