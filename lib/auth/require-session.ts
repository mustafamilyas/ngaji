import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ForbiddenError } from "@/lib/errors";
import type { SessionUser } from "./session-user";

/**
 * The one way a Server Action gets its caller. Server Actions are dispatched
 * by the `Next-Action` header, not by URL, so `proxy.ts`'s path redirect for
 * `mustChangePassword` cannot protect them: a user who must still change
 * their password could post any action to `/dashboard/akun/password`. Only the
 * password-change action opts in via `allowPasswordChange`.
 */
export async function requireSession(
  options: { allowPasswordChange?: boolean } = {},
): Promise<SessionUser> {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.mustChangePassword && !options.allowPasswordChange) {
    throw new ForbiddenError("Ganti password Anda terlebih dahulu");
  }
  return session.user;
}
