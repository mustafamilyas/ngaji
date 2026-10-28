import type { JWT } from "@auth/core/jwt";
import type { User } from "@auth/core/types";
import { revalidateSessionUser } from "./revalidate";

/** Copies the claims `authorize()` read fresh into a brand-new token at sign-in. */
export function claimsFromSignIn(token: JWT, user: User): JWT {
  token.id = user.id;
  token.username = user.username;
  token.name = user.name;
  token.role = user.role;
  token.groupId = user.groupId;
  token.groupPath = user.groupPath;
  token.organizationId = user.organizationId;
  token.timeZone = user.timeZone;
  token.mustChangePassword = user.mustChangePassword;
  token.extraRoles = user.extraRoles;
  token.sessionVersion = user.sessionVersion;
  return token;
}

/**
 * Every later session read: re-validate against the DB (DESIGN.md §4.1) so a
 * deactivation, role/group change or password change/reset takes effect on
 * the next request. `sessionVersion` is only ever compared, never written
 * here — in particular not from the `update` trigger's payload — so a stolen
 * session cannot adopt the new version. Returns null to end the session.
 */
export async function refreshTokenClaims(token: JWT): Promise<JWT | null> {
  const fresh = await revalidateSessionUser(Number(token.id), token.sessionVersion);
  if (!fresh) return null;

  token.username = fresh.username;
  token.name = fresh.name;
  token.role = fresh.role;
  token.groupId = fresh.groupId;
  token.groupPath = fresh.groupPath;
  token.organizationId = fresh.organizationId;
  token.timeZone = fresh.timeZone;
  token.mustChangePassword = fresh.mustChangePassword;
  token.extraRoles = fresh.extraRoles;
  return token;
}
