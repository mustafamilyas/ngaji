import { ForbiddenError, NotFoundError } from "./errors";
import { isAncestorOf, isInScope } from "./scope";
import type { SessionUser } from "./auth/session-user";
import type { Role } from "./validation/enums";

export type Action =
  | "group.view"
  | "group.create"
  | "group.update"
  | "group.delete"
  | "member.view"
  | "member.create"
  | "member.update"
  | "member.delete"
  | "activity.view"
  | "activity.create"
  | "activity.update"
  | "activity.delete"
  | "activity.split"
  | "occurrence.override"
  | "attendance.record"
  | "stats.view"
  | "user.view"
  | "user.create"
  | "user.updateRole"
  | "user.move"
  | "user.setActive"
  | "user.resetPassword"
  | "level.rename"
  | "audit.view";

type ScopeTarget = { groupPath: string };
type ActivityGroupTarget = { groupId: number };
type AttendanceTarget = { activityGroupPath: string; leafGroupPath: string; isLeaf: boolean };
type UserCreateTarget = { groupPath: string; newRole: Role };
type ResetPasswordTarget = { groupPath: string; role: Role; groupId: number };
type UserMutateTarget = { userId: number; groupPath: string; isLastActiveRootOwner?: boolean };

const ROLE_RANK: Record<Role, number> = { USER: 0, ADMIN: 1, OWNER: 2 };

function atLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** A root group's path has exactly one id segment ("1/"). */
function isRootPath(path: string): boolean {
  return path.split("/").filter(Boolean).length === 1;
}

/** `visibleGroupsWhere(session)` — scope filter reused by every list query (DESIGN.md §3.5). */
export function visibleGroupsWhere(session: SessionUser) {
  return { path: { startsWith: session.groupPath }, deletedAt: null };
}

/** DESIGN.md §3.3 "Terlihat": `X ∈ ancestors(G) ∪ scope(U)`. */
export function canViewActivity(session: SessionUser, activityGroupPath: string): boolean {
  return (
    isInScope(activityGroupPath, session.groupPath) ||
    isAncestorOf(activityGroupPath, session.groupPath)
  );
}

/** DESIGN.md §3.3 "Ubah": strictly the owning group, role >= ADMIN. No override for root OWNER. */
export function canEditActivity(session: SessionUser, activityGroupId: number): boolean {
  return session.groupId === activityGroupId && atLeast(session.role, "ADMIN");
}

/**
 * DESIGN.md §3.3 "Absensi", structural conditions 1–3 only (the caller's
 * group is at-or-above the activity's owning group; the leaf group is in
 * the caller's own scope and actually a leaf; the activity applies to that
 * leaf). Occurrence-date validity and per-member `expected()` checks
 * (conditions 4–5) need `occurrencesFor`/`expected` and live outside authz.
 */
export function canRecordAttendance(
  session: SessionUser,
  activityGroupPath: string,
  leafGroup: { path: string; isLeaf: boolean },
): boolean {
  const sessionAtOrBelowActivityGroup = isInScope(session.groupPath, activityGroupPath);
  const leafInOwnScope = leafGroup.isLeaf && isInScope(leafGroup.path, session.groupPath);
  const activityAppliesToLeaf = isInScope(leafGroup.path, activityGroupPath);
  return sessionAtOrBelowActivityGroup && leafInOwnScope && activityAppliesToLeaf;
}

function assertInScope(session: SessionUser, groupPath: string): void {
  if (!isInScope(groupPath, session.groupPath)) {
    throw new NotFoundError();
  }
}

export function authorize(
  session: SessionUser,
  action:
    | "group.view"
    | "group.create"
    | "group.update"
    | "group.delete"
    | "member.view"
    | "member.create"
    | "member.update"
    | "member.delete"
    | "stats.view"
    | "user.view"
    | "activity.view",
  target: ScopeTarget,
): void;
export function authorize(
  session: SessionUser,
  action: "activity.create" | "activity.update" | "activity.delete" | "activity.split" | "occurrence.override",
  target: ActivityGroupTarget,
): void;
export function authorize(
  session: SessionUser,
  action: "attendance.record",
  target: AttendanceTarget,
): void;
export function authorize(
  session: SessionUser,
  action: "user.create",
  target: UserCreateTarget,
): void;
export function authorize(
  session: SessionUser,
  action: "user.resetPassword",
  target: ResetPasswordTarget,
): void;
export function authorize(
  session: SessionUser,
  action: "user.updateRole" | "user.move" | "user.setActive",
  target: UserMutateTarget,
): void;
export function authorize(session: SessionUser, action: "level.rename"): void;
export function authorize(session: SessionUser, action: "audit.view"): void;
export function authorize(session: SessionUser, action: Action, target?: unknown): void {
  switch (action) {
    case "group.view":
    case "member.view":
    case "stats.view":
    case "user.view": {
      const { groupPath } = target as ScopeTarget;
      assertInScope(session, groupPath);
      return;
    }

    case "member.create":
    case "member.update":
    case "member.delete": {
      const { groupPath } = target as ScopeTarget;
      assertInScope(session, groupPath);
      return;
    }

    case "group.create":
    case "group.update":
    case "group.delete": {
      const { groupPath } = target as ScopeTarget;
      assertInScope(session, groupPath);
      if (!atLeast(session.role, "ADMIN")) throw new ForbiddenError();
      return;
    }

    case "activity.view": {
      const { groupPath } = target as ScopeTarget;
      if (!canViewActivity(session, groupPath)) throw new NotFoundError();
      return;
    }

    case "activity.create": {
      const { groupId } = target as ActivityGroupTarget;
      if (!atLeast(session.role, "ADMIN")) throw new ForbiddenError();
      if (groupId !== session.groupId) throw new ForbiddenError();
      return;
    }

    case "activity.update":
    case "activity.delete":
    case "activity.split":
    case "occurrence.override": {
      const { groupId } = target as ActivityGroupTarget;
      if (!canEditActivity(session, groupId)) throw new ForbiddenError();
      return;
    }

    case "attendance.record": {
      const { activityGroupPath, leafGroupPath, isLeaf } = target as AttendanceTarget;
      const ok = canRecordAttendance(session, activityGroupPath, { path: leafGroupPath, isLeaf });
      if (!ok) throw new ForbiddenError();
      return;
    }

    case "user.create": {
      const { groupPath, newRole } = target as UserCreateTarget;
      assertInScope(session, groupPath);
      if (!atLeast(session.role, "ADMIN")) throw new ForbiddenError();
      if (newRole === "OWNER" && session.role !== "OWNER") throw new ForbiddenError();
      return;
    }

    case "user.resetPassword": {
      const { groupPath, role, groupId } = target as ResetPasswordTarget;
      assertInScope(session, groupPath);
      if (session.role === "OWNER") return;
      if (session.role === "ADMIN") {
        if (role !== "USER" || groupId !== session.groupId) throw new ForbiddenError();
        return;
      }
      throw new ForbiddenError();
    }

    case "user.updateRole":
    case "user.setActive":
    case "user.move": {
      const { userId, groupPath, isLastActiveRootOwner } = target as UserMutateTarget;
      assertInScope(session, groupPath);
      if (session.role !== "OWNER") throw new ForbiddenError();
      if (action !== "user.move") {
        if (userId === Number(session.id)) throw new ForbiddenError();
        if (isLastActiveRootOwner) throw new ForbiddenError();
      }
      return;
    }

    case "level.rename": {
      if (session.role !== "OWNER" || !isRootPath(session.groupPath)) {
        throw new ForbiddenError();
      }
      return;
    }

    case "audit.view": {
      if (session.role !== "OWNER") throw new ForbiddenError();
      return;
    }
  }
}
