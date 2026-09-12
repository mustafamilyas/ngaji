import bcrypt from "bcrypt";
import { db } from "@/lib/db";
import { credentialsSchema } from "@/lib/validation/auth";
import { toSessionUser, type SessionUser } from "./session-user";

export type CredentialsFailureReason =
  | "invalid_input"
  | "unknown_user"
  | "inactive"
  | "wrong_password"
  | "rate_limited";

export type CredentialsResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: CredentialsFailureReason; actorId: number | null; username: string | null };

/**
 * Best-effort username for the rate-limit check, which must run before full
 * schema validation (an over-limit attempt is refused without even
 * comparing the password). Not a validity claim — just "is there a string
 * here worth counting failures against".
 */
export function extractUsername(input: unknown): string | null {
  if (input && typeof input === "object" && typeof (input as { username?: unknown }).username === "string") {
    return (input as { username: string }).username;
  }
  return null;
}

/**
 * Resolves login credentials to a session user, or a typed failure reason.
 * The caller (auth.ts) turns every failure into the same generic
 * "username atau password salah" message (DESIGN.md §4.1) but still needs
 * the reason and actorId to audit `auth.login_failed` correctly — `actorId`
 * is only null when the username itself is unknown (DESIGN.md §4.4).
 */
export async function verifyCredentials(input: unknown): Promise<CredentialsResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid_input", actorId: null, username: null };
  }
  const { username, password } = parsed.data;

  const user = await db.user.findUnique({
    where: { username },
    include: { role: { include: { group: true } } },
  });

  if (!user) {
    return { ok: false, reason: "unknown_user", actorId: null, username };
  }
  if (!user.isActive || !user.role) {
    return { ok: false, reason: "inactive", actorId: user.id, username };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { ok: false, reason: "wrong_password", actorId: user.id, username };
  }

  return { ok: true, user: toSessionUser({ ...user, role: user.role }) };
}
