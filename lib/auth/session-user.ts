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
  mustChangePassword: boolean;
};

/** Shape shared by the `verifyCredentials`/`revalidateSessionUser` DB reads. */
export type ResolvedUser = {
  id: number;
  username: string;
  name: string;
  mustChangePassword: boolean;
  role: { role: string; groupId: number; group: { path: string } };
};

export function toSessionUser(user: ResolvedUser): SessionUser {
  return {
    id: String(user.id),
    username: user.username,
    name: user.name,
    role: user.role.role as Role,
    groupId: user.role.groupId,
    groupPath: user.role.group.path,
    mustChangePassword: user.mustChangePassword,
  };
}
