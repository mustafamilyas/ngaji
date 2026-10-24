import type { Role } from "@/lib/validation/enums";

/**
 * Claims carried by the session JWT (DESIGN.md §4.1). Kept intentionally
 * small; `role`/`groupId`/`isActive` are re-read from the DB on every
 * request rather than trusted from the token long-term.
 */
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
    sessionVersion: user.sessionVersion,
  };
}
