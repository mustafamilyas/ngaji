import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { isAncestorOf, isInScope } from "@/lib/scope";
import { canViewTag, visibleTagWhere } from "@/lib/tag/access";
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

/**
 * Resolves to a tag the session may see: owned by its own group, an ancestor,
 * or a descendant (DESIGN.md §13.2). Anything else, a deleted tag or another
 * organization's tag is a 404. Whether the tag may also be *used* is
 * `authorize("tag.use")`'s job (403); the owner group is included for it.
 */
export async function resolveTag(session: SessionUser, tagId: number) {
  const tag = await db.tag.findUnique({ where: { id: tagId }, include: { group: true } });
  if (!tag || !canViewTag(session, tag.group.path)) throw new NotFoundError();
  return tag;
}

/**
 * List variant for filters: ids that are missing, deleted or not visible are
 * dropped instead of failing the page (design D5). Input order, de-duplicated.
 */
export async function resolveVisibleTags(session: SessionUser, tagIds: number[]) {
  const ids = [...new Set(tagIds)];
  if (ids.length === 0) return [];

  const tags = await db.tag.findMany({
    where: { id: { in: ids }, ...visibleTagWhere(session) },
    include: { group: true },
  });
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  return ids.flatMap((id) => byId.get(id) ?? []);
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

const isTagRule = (rule: Rule) => rule.field === "tag";

/** Ids of every tag rule in the definition that the viewer may see (live, same organization, ancestor or in scope). */
async function visibleRuleTagIds(session: SessionUser, definition: Definition) {
  const ids = new Set<number>();
  for (const group of definition.filter.groups) {
    for (const rule of group.rules) {
      if (isTagRule(rule)) for (const id of rule.value as number[]) ids.add(id);
    }
  }
  const visible = await resolveVisibleTags(session, [...ids]);
  return new Set(visible.map((tag) => tag.id));
}

/**
 * Save-time check: every tag id in a tag rule must be a tag the viewer can see
 * (`visibleTagWhere`), else the whole save is rejected. Unknown, deleted, other
 * organization and invisible ids share one generic message.
 */
export async function resolveDefinitionTagsStrict(session: SessionUser, definition: Definition) {
  const valid = await visibleRuleTagIds(session, definition);
  for (const group of definition.filter.groups) {
    for (const rule of group.rules) {
      if (isTagRule(rule) && (rule.value as number[]).some((id) => !valid.has(id))) {
        throw new ValidationError("Tag tidak valid");
      }
    }
  }
}

/**
 * Load-time check: unusable ids are removed from a tag rule, a rule left with
 * none is dropped, and so is a rule group left empty. Unlike group rules, the
 * remaining ids still apply (the spec removes ids, not whole rules). `dropped`
 * drives the "Beberapa aturan diabaikan" notice. Returns a new definition.
 */
export async function resolveDefinitionTagsLenient(session: SessionUser, definition: Definition) {
  const valid = await visibleRuleTagIds(session, definition);
  let dropped = false;
  const groups = [];
  for (const group of definition.filter.groups) {
    const rules: Rule[] = [];
    for (const rule of group.rules) {
      if (!isTagRule(rule)) {
        rules.push(rule);
        continue;
      }
      const ids = rule.value as number[];
      const kept = ids.filter((id) => valid.has(id));
      if (kept.length !== ids.length) dropped = true;
      if (kept.length > 0) rules.push({ ...rule, value: kept });
    }
    if (rules.length > 0) groups.push({ ...group, rules });
  }
  return { definition: { ...definition, filter: { ...definition.filter, groups } }, dropped };
}

type TagSummary = { dimension: { kind: "tag" | "tagKey"; tagId: number } };
const isTagSummary = (summary: { dimension: { kind: string } }): summary is TagSummary =>
  summary.dimension.kind === "tag" || summary.dimension.kind === "tagKey";

/**
 * Ids of summaries whose tag the viewer can use: visible and live, a simple tag
 * for a "tag" summary and a key–value tag (the key's anchor) for a "tagKey"
 * one. A deleted anchor value is unusable even if the key has other values.
 */
async function usableSummaryTagIds(session: SessionUser, definition: Definition) {
  const tagSummaries = (definition.summaries ?? []).filter(isTagSummary);
  const visible = await resolveVisibleTags(session, tagSummaries.map((s) => s.dimension.tagId));
  const valueOf = new Map(visible.map((tag) => [tag.id, tag.value]));
  return (summary: TagSummary) => {
    const value = valueOf.get(summary.dimension.tagId);
    if (value === undefined) return false;
    return summary.dimension.kind === "tag" ? value === null : value !== null;
  };
}

/**
 * Save-time check: every tag a summary refers to must be usable (see above),
 * else the whole save is rejected with one generic message.
 */
export async function resolveDefinitionSummariesStrict(session: SessionUser, definition: Definition) {
  const usable = await usableSummaryTagIds(session, definition);
  if ((definition.summaries ?? []).some((s) => isTagSummary(s) && !usable(s))) {
    throw new ValidationError("Tag tidak valid");
  }
}

/**
 * Load-time check: summaries on an unusable tag are dropped (the rest keep
 * their order); `dropped` drives the "Beberapa aturan diabaikan" notice.
 * Returns a new definition; the input is not mutated.
 */
export async function resolveDefinitionSummariesLenient(session: SessionUser, definition: Definition) {
  if (!definition.summaries) return { definition, dropped: false };
  const usable = await usableSummaryTagIds(session, definition);
  const summaries = definition.summaries.filter((s) => !isTagSummary(s) || usable(s));
  return { definition: { ...definition, summaries }, dropped: summaries.length !== definition.summaries.length };
}
