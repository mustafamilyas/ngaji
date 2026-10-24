import { cache } from "react";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session-user";
import { loginBrand } from "@/lib/login-brand";

const FALLBACK_NAME = "Dahan";

export type OrganizationInfo = { name: string; timeZone: string };

// Keyed by the primitive id so React's per-request `cache` dedupes across callers.
const loadOrganization = cache(async (organizationId: number, fallbackTimeZone: string): Promise<OrganizationInfo> => {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, timezone: true },
  });
  return organization
    ? { name: organization.name, timeZone: organization.timezone }
    : { name: FALLBACK_NAME, timeZone: fallbackTimeZone };
});

/** The signed-in user's own organization (from `session.user.organizationId`, never client input); one lookup per request. */
export function getOrganization(session: { user: Pick<SessionUser, "organizationId" | "timeZone"> }): Promise<OrganizationInfo> {
  return loadOrganization(session.user.organizationId, session.user.timeZone);
}

/** Brand shown on `/login` (no session): see `loginBrand` for when an organization name is revealed. */
export const getLoginBrand = cache(async (): Promise<string> => {
  const organizations = await db.organization.findMany({ take: 2, orderBy: { id: "asc" }, select: { name: true } });
  return loginBrand(process.env.LOGIN_SHOW_ORG_NAME, organizations);
});
