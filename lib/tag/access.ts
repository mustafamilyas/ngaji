import { ancestorPathsOf, isAncestorOf, isInScope } from "@/lib/scope";
import type { SessionUser } from "@/lib/auth/session-user";

// Pure path rules for tags (design D3, DESIGN.md §13.2–13.3). Callers resolve the tag, member
// or activity first (404 for anything not visible) and pass the owning groups' paths.
type TagUser = Pick<SessionUser, "groupPath">;

/** Ancestor-or-scope visibility of a group's data: the same rule as `canViewActivity` in lib/authz.ts (kept here so authz can import this module). */
function isVisibleGroup(user: TagUser, groupPath: string): boolean {
  return isInScope(groupPath, user.groupPath) || isAncestorOf(groupPath, user.groupPath);
}

/** Visible: the tag's owner group is an ancestor-or-self of the user's group, or in the user's scope. */
export function canViewTag(user: TagUser, tagGroupPath: string): boolean {
  return isVisibleGroup(user, tagGroupPath);
}

/** Usable (attach/detach): the owner group is the user's group or one of its ancestors. */
export function canUseTag(user: TagUser, tagGroupPath: string): boolean {
  return isInScope(user.groupPath, tagGroupPath);
}

/** The tag is usable, the member is in the user's scope, and the member lives in the tag group's subtree. */
export function canTagMember(user: TagUser, tagGroupPath: string, memberGroupPath: string): boolean {
  return (
    canUseTag(user, tagGroupPath) &&
    isInScope(memberGroupPath, user.groupPath) &&
    isInScope(memberGroupPath, tagGroupPath)
  );
}

/** The tag is usable, the activity is visible, and its group is on the tag group's ancestor chain or in its subtree. No edit right needed. */
export function canTagActivity(user: TagUser, tagGroupPath: string, activityGroupPath: string): boolean {
  return (
    canUseTag(user, tagGroupPath) &&
    isVisibleGroup(user, activityGroupPath) &&
    (isInScope(tagGroupPath, activityGroupPath) || isInScope(activityGroupPath, tagGroupPath))
  );
}

/** Prisma `where` for tags the user may see, for `include`/`findMany` on `Tag` (non-deleted only). */
export function visibleTagWhere(user: TagUser) {
  return {
    deletedAt: null,
    group: {
      OR: [
        { path: { in: ancestorPathsOf(user.groupPath) } },
        { path: { startsWith: user.groupPath } },
      ],
    },
  };
}
