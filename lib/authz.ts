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
  | "survey.view"
  | "survey.create"
  | "survey.update"
  | "survey.delete"
  | "survey_response.record"
  | "survey_response.delete"
  | "stats.view"
  | "user.view"
  | "user.create"
  | "user.updateRole"
  | "user.move"
  | "user.setActive"
  | "user.resetPassword"
  | "level.rename"
  | "audit.view"
  | "member_view.view"
  | "member_view.create"
  | "member_view.update"
  | "member_view.delete"
  | "member_view.transfer";

type ScopeTarget = { groupPath: string };
type ActivityGroupTarget = { groupId: number };
type AttendanceTarget = { activityGroupPath: string; leafGroupPath: string; isLeaf: boolean };
type SurveyViewTarget = { surveyGroupPath: string };
type SurveyResponseTarget = { surveyGroupPath: string; memberGroupPath: string; memberIsLeaf: boolean };
type UserCreateTarget = { groupPath: string; newRole: Role };
type ResetPasswordTarget = { groupPath: string; role: Role; groupId: number };
type UserMutateTarget = { userId: number; groupPath: string; isLastActiveRootOwner?: boolean };

type MemberViewCreateTarget = { groupId: number };
/** A resolved, non-deleted view plus its owner's current state (see `resolveMemberView`). */
type MemberViewTarget = {
  groupId: number;
  ownerId: number;
  ownerIsActive: boolean;
  /** null when the owner has no role assignment (always orphaned). */
  ownerGroupId: number | null;
};

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

/** Surveys inherit exactly like activities: visible = ancestor-or-scope. */
export const canViewSurvey = canViewActivity;

/** Survey edits are strictly the owning group, role >= ADMIN (same as activities). */
export const canEditSurvey = canEditActivity;

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
  action: "survey.view",
  target: SurveyViewTarget,
): void;
export function authorize(
  session: SessionUser,
  action: "survey.create" | "survey.update" | "survey.delete",
  target: ActivityGroupTarget,
): void;
export function authorize(
  session: SessionUser,
  action: "survey_response.record" | "survey_response.delete",
  target: SurveyResponseTarget,
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
export function authorize(
  session: SessionUser,
  action: "member_view.create",
  target: MemberViewCreateTarget,
): void;
export function authorize(
  session: SessionUser,
  action: "member_view.view" | "member_view.update" | "member_view.delete" | "member_view.transfer",
  target: MemberViewTarget,
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

    case "survey.view": {
      const { surveyGroupPath } = target as SurveyViewTarget;
      if (!canViewSurvey(session, surveyGroupPath)) throw new NotFoundError();
      return;
    }

    case "survey.create": {
      const { groupId } = target as ActivityGroupTarget;
      if (!atLeast(session.role, "ADMIN")) throw new ForbiddenError();
      if (groupId !== session.groupId) throw new ForbiddenError();
      return;
    }

    case "survey.update":
    case "survey.delete": {
      const { groupId } = target as ActivityGroupTarget;
      if (!canEditSurvey(session, groupId)) throw new ForbiddenError();
      return;
    }

    case "survey_response.record":
    case "survey_response.delete": {
      const { surveyGroupPath, memberGroupPath, memberIsLeaf } = target as SurveyResponseTarget;
      // Existence first: a survey or member outside the caller's reach is a 404.
      if (!canViewSurvey(session, surveyGroupPath)) throw new NotFoundError();
      assertInScope(session, memberGroupPath);
      // Visible but not actionable: survey must be at-or-above the caller's group.
      const surveyAtOrAboveSession = isInScope(session.groupPath, surveyGroupPath);
      if (!surveyAtOrAboveSession || !memberIsLeaf) throw new ForbiddenError();
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
      if (session.role === "OWNER") {
        // Peer OWNERs are recovered via the CLI, not by each other (design.md §8).
        if (role === "OWNER" && !isAncestorOf(session.groupPath, groupPath)) throw new ForbiddenError();
        return;
      }
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

    case "member_view.create": {
      const { groupId } = target as MemberViewCreateTarget;
      if (groupId !== session.groupId) throw new ForbiddenError();
      return;
    }

    case "member_view.view":
    case "member_view.update":
    case "member_view.delete":
    case "member_view.transfer": {
      const view = target as MemberViewTarget;
      // Views are visible to their exact group only: ancestors and descendants get 404.
      if (view.groupId !== session.groupId) throw new NotFoundError();
      if (action === "member_view.update" || action === "member_view.delete") {
        if (view.ownerId !== Number(session.id)) throw new ForbiddenError();
      } else if (action === "member_view.transfer") {
        if (!atLeast(session.role, "ADMIN")) throw new ForbiddenError();
        const orphaned = !view.ownerIsActive || view.ownerGroupId !== view.groupId;
        if (!orphaned) throw new ForbiddenError();
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
