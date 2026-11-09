import type { Role } from "@/lib/validation/enums";

/**
 * Claims carried by the session JWT (DESIGN.md §4.1). Kept intentionally
 * small; `role`/`groupId`/`isActive` are re-read from the DB on every
 * request rather than trusted from the token long-term.
 */
export type ExtraRole = { groupId: number; role: Role };

export type SessionUser = {
  /** Prisma `User.id`, stringified — Auth.js requires `User.id: string`. */
  id: string;
  username: string;
  name: string;
  role: Role;
  groupId: number;
  groupPath: string;
  /** `Group.organizationId` of the user's group; re-read on every request. */
  organizationId: number;
  /** IANA zone of the user's organization (`Organization.timezone`); re-read on every request. */
  timeZone: string;
  mustChangePassword: boolean;
  /** Additional roles at groups below `groupId` (DESIGN.md §3.2a); absent on hand-built test sessions. */
  extraRoles?: ExtraRole[];
  /** Copied into the JWT at sign-in; a mismatch with the DB value revokes the session. Absent on hand-built test sessions. */
  sessionVersion?: number;
};

/** Shape shared by the `verifyCredentials`/`revalidateSessionUser` DB reads. */
export type ResolvedUser = {
  id: number;
  username: string;
  name: string;
  mustChangePassword: boolean;
  sessionVersion: number;
  extraRoles: { groupId: number; role: string }[];
  role: {
    role: string;
    groupId: number;
    group: { path: string; organizationId: number; organization: { timezone: string } };
  };
};

export function toSessionUser(user: ResolvedUser): SessionUser {
  return {
    id: String(user.id),
    username: user.username,
    name: user.name,
    role: user.role.role as Role,
    groupId: user.role.groupId,
    groupPath: user.role.group.path,
    organizationId: user.role.group.organizationId,
    timeZone: user.role.group.organization.timezone,
    mustChangePassword: user.mustChangePassword,
    extraRoles: user.extraRoles.map((r) => ({ groupId: r.groupId, role: r.role as Role })),
    sessionVersion: user.sessionVersion,
  };
}

/** DESIGN.md §3.2/§3.5: an OWNER whose own group is the organization's root (path holds only its own id). */
export function isRootOwner(session: Pick<SessionUser, "role" | "groupPath">): boolean {
  return session.role === "OWNER" && session.groupPath.split("/").filter(Boolean).length === 1;
}
