import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { isAncestorOf, isInScope } from "@/lib/scope";
import type { Definition, Rule } from "@/lib/validation/member-view";
import type { SessionUser } from "./auth/session-user";

/**
 * Every client-supplied id is resolved to its entity here — never trusted
 * raw — and out-of-scope entities throw the same `NotFoundError` as ones
 * that don't exist, so existence outside a caller's scope is never leaked
 * (DESIGN.md §3.1, §4.2). Soft-deleted rows are excluded by `lib/db.ts`'s
 * extension for the top-level Group/Member/Activity read in each function.
 */

export async function resolveGroup(session: SessionUser, groupId: number) {
  const group = await db.group.findUnique({ where: { id: groupId } });
  if (!group || !isInScope(group.path, session.groupPath)) {
    throw new NotFoundError();
  }
  return group;
}

/**
 * Resolves every id of a multi-group filter; any id that is missing or out
 * of scope fails the whole request with `NotFoundError` (404), like a single
 * `resolveGroup`. Returns the groups in input order, de-duplicated.
 */
export async function resolveGroups(session: SessionUser, groupIds: number[]) {
  const groups = [];
  for (const id of new Set(groupIds)) {
    groups.push(await resolveGroup(session, id));
  }
  return groups;
}

export async function resolveMember(session: SessionUser, memberId: number) {
  const member = await db.member.findUnique({
    where: { id: memberId },
    include: { group: true },
  });
  if (!member || !isInScope(member.group.path, session.groupPath)) {
    throw new NotFoundError();
  }
  return member;
}

/**
 * Resolves to the minimum bar for an activity to be visible at all: owned
 * by the session's own group, one of its descendants, or one of its
 * ancestors (DESIGN.md §3.3 "Terlihat" — `X ∈ ancestors(G) ∪ scope(U)`).
 * Edit/attendance rights beyond that are `lib/authz.ts`'s job.
 */
export async function resolveActivity(session: SessionUser, activityId: number) {
  const activity = await db.activity.findUnique({
    where: { id: activityId },
    include: { group: true },
  });
  if (!activity) throw new NotFoundError();

  const visible =
    isInScope(activity.group.path, session.groupPath) ||
    isAncestorOf(activity.group.path, session.groupPath);
  if (!visible) throw new NotFoundError();

  return activity;
}

/**
 * Resolves to a visible survey: owned by the session's own group, a
 * descendant, or an ancestor (inherited) — same bar as `resolveActivity`.
 * Soft-deleted surveys are filtered by `lib/db.ts`. Edit/record rights
 * are `lib/authz.ts`'s job.
 */
export async function resolveSurvey(session: SessionUser, surveyId: number) {
  const survey = await db.survey.findUnique({
    where: { id: surveyId },
    include: { group: true },
  });
  if (!survey) throw new NotFoundError();

  const visible =
    isInScope(survey.group.path, session.groupPath) ||
    isAncestorOf(survey.group.path, session.groupPath);
  if (!visible) throw new NotFoundError();

  return survey;
}

export async function resolveOccurrence(session: SessionUser, occurrenceId: number) {
  const occurrence = await db.activityOccurrence.findUnique({
    where: { id: occurrenceId },
    include: { activity: { include: { group: true } } },
  });
  if (!occurrence || occurrence.activity.deletedAt) throw new NotFoundError();

  const visible =
    isInScope(occurrence.activity.group.path, session.groupPath) ||
    isAncestorOf(occurrence.activity.group.path, session.groupPath);
  if (!visible) throw new NotFoundError();

  return occurrence;
}

export async function resolveUser(session: SessionUser, userId: number) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { role: { include: { group: true } }, extraRoles: { include: { group: true } } },
  });
  if (!user || !user.role || !isInScope(user.role.group.path, session.groupPath)) {
    throw new NotFoundError();
  }
  return user;
}

/**
 * Resolves a non-deleted member view plus its owner's current state, which
 * `authorize` needs for update/delete/transfer (orphaned = owner inactive or
 * no longer in the view's group). Deliberately does not check the viewer's
 * group: `authorize("member_view.*")` owns the 404-for-other-groups rule.
 * `ownerGroupId` is null when the owner has no role assignment.
 */
export async function resolveMemberView(_session: SessionUser, viewId: number) {
  const view = await db.memberView.findUnique({
    where: { id: viewId },
    include: { owner: { select: { name: true, isActive: true, role: { select: { groupId: true } } } } },
  });
  if (!view) throw new NotFoundError();

  const { owner, ...rest } = view;
  return { ...rest, ownerName: owner.name, ownerIsActive: owner.isActive, ownerGroupId: owner.role?.groupId ?? null };
}

const isGroupRule = (rule: Rule) => rule.field === "group";

/** Ids of every group rule in the definition, and which of them are live and in the viewer's scope. */
async function groupIdValidity(session: SessionUser, definition: Definition) {
  const ids = new Set<number>();
  for (const group of definition.filter.groups) {
    for (const rule of group.rules) {
      if (isGroupRule(rule)) for (const id of rule.value as number[]) ids.add(id);
    }
  }
  if (ids.size === 0) return { valid: new Set<number>() };

  // The soft-delete extension on `db.group` already excludes deleted groups.
  const groups = await db.group.findMany({ where: { id: { in: [...ids] } }, select: { id: true, path: true } });
  return { valid: new Set(groups.filter((g) => isInScope(g.path, session.groupPath)).map((g) => g.id)) };
}

/**
 * Save-time check: every group id in a definition must exist, be non-deleted
 * and be in the viewer's scope, else the whole save is rejected. The message
 * is generic so it does not reveal whether an out-of-scope group exists.
 */
export async function resolveDefinitionGroupsStrict(session: SessionUser, definition: Definition) {
  const { valid } = await groupIdValidity(session, definition);
  for (const group of definition.filter.groups) {
    for (const rule of group.rules) {
      if (isGroupRule(rule) && (rule.value as number[]).some((id) => !valid.has(id))) {
        throw new ValidationError("Grup tidak valid");
      }
    }
  }
}

/**
 * Load-time check: a group rule with any missing, deleted or out-of-scope id
 * is dropped as a whole (so a filter is never silently widened or narrowed),
 * along with any rule group left empty. `dropped` drives the "Beberapa aturan
 * diabaikan" notice. Returns a new definition; the input is not mutated.
 */
export async function resolveDefinitionGroupsLenient(session: SessionUser, definition: Definition) {
  const { valid } = await groupIdValidity(session, definition);
  let dropped = false;
  const groups = [];
  for (const group of definition.filter.groups) {
    const rules = group.rules.filter((rule) => {
      const keep = !isGroupRule(rule) || (rule.value as number[]).every((id) => valid.has(id));
      if (!keep) dropped = true;
      return keep;
    });
    if (rules.length > 0) groups.push({ ...group, rules });
  }
  return { definition: { ...definition, filter: { ...definition.filter, groups } }, dropped };
}
