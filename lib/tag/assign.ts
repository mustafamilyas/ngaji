import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { TAG_MAX_PER_ENTITY } from "@/lib/constants";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { resolveActivity, resolveMember, resolveTag } from "@/lib/resolve";
import type { ActivityTagInput, BulkTagMembersInput, MemberTagInput } from "@/lib/validation/tag";
import { canTagActivity, canTagMember } from "./access";
import { tagIdsReplacedBy, type LinkedTag } from "./exclusive";

// Attach/detach of one tag on one member or activity (DESIGN.md §13.3, design D4). Order of checks:
// resolve both ids (404), then the tag must be usable (403), then it must fit the entity (validation).

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
type ResolvedTag = Awaited<ReturnType<typeof resolveTag>>;

export type AttachResult = { changed: boolean; replacedTagIds: number[] };
export type DetachResult = { changed: boolean };

const NOT_APPLICABLE = "Tag tidak dapat dipasang pada data ini";

/**
 * Decides what attaching `tag` does to an entity whose current non-deleted tags are `current`:
 * nothing (already there), or the ids to replace, rejecting when the result would exceed the cap.
 */
function planAttach(current: LinkedTag[], tag: ResolvedTag): { changed: boolean; replacedTagIds: number[] } {
  if (current.some((t) => t.id === tag.id)) return { changed: false, replacedTagIds: [] };
  const replacedTagIds = tagIdsReplacedBy(current, tag);
  if (current.length - replacedTagIds.length + 1 > TAG_MAX_PER_ENTITY) {
    throw new ValidationError(`Satu data maksimal memiliki ${TAG_MAX_PER_ENTITY} tag`);
  }
  return { changed: true, replacedTagIds };
}

async function currentMemberTags(tx: Tx, memberId: number): Promise<LinkedTag[]> {
  const links = await tx.memberTag.findMany({ where: { memberId, tag: { deletedAt: null } }, include: { tag: true } });
  return links.map((link) => link.tag);
}

async function currentActivityTags(tx: Tx, activityId: number): Promise<LinkedTag[]> {
  const links = await tx.activityTag.findMany({ where: { activityId, tag: { deletedAt: null } }, include: { tag: true } });
  return links.map((link) => link.tag);
}

export async function attachMemberTag(session: SessionUser, input: MemberTagInput): Promise<AttachResult> {
  const member = await resolveMember(session, input.memberId);
  const tag = await resolveTag(session, input.tagId);
  authorize(session, "tag.use", { groupPath: tag.group.path });
  if (!canTagMember(session, tag.group.path, member.group.path)) throw new ValidationError(NOT_APPLICABLE);

  const actorId = Number(session.id);
  return db.$transaction(async (tx) => {
    const plan = planAttach(await currentMemberTags(tx, member.id), tag);
    if (!plan.changed) return plan;

    if (plan.replacedTagIds.length > 0) {
      await tx.memberTag.deleteMany({ where: { memberId: member.id, tagId: { in: plan.replacedTagIds } } });
    }
    await tx.memberTag.create({ data: { memberId: member.id, tagId: tag.id, createdById: actorId } });
    await audit(tx, {
      actorId,
      action: "member.tag",
      entity: "Member",
      entityId: member.id,
      groupId: member.groupId,
      meta: { tagId: tag.id, memberIds: [member.id], replacedTagIds: plan.replacedTagIds },
    });
    return plan;
  });
}

export async function detachMemberTag(session: SessionUser, input: MemberTagInput): Promise<DetachResult> {
  const member = await resolveMember(session, input.memberId);
  const tag = await resolveTag(session, input.tagId);
  authorize(session, "tag.use", { groupPath: tag.group.path });

  return db.$transaction(async (tx) => {
    const { count } = await tx.memberTag.deleteMany({ where: { memberId: member.id, tagId: tag.id } });
    if (count === 0) return { changed: false };

    await audit(tx, {
      actorId: Number(session.id),
      action: "member.untag",
      entity: "Member",
      entityId: member.id,
      groupId: member.groupId,
      meta: { tagId: tag.id, memberIds: [member.id], replacedTagIds: [] },
    });
    return { changed: true };
  });
}

export async function attachActivityTag(session: SessionUser, input: ActivityTagInput): Promise<AttachResult> {
  const activity = await resolveActivity(session, input.activityId);
  const tag = await resolveTag(session, input.tagId);
  authorize(session, "tag.use", { groupPath: tag.group.path });
  if (!canTagActivity(session, tag.group.path, activity.group.path)) throw new ValidationError(NOT_APPLICABLE);

  const actorId = Number(session.id);
  return db.$transaction(async (tx) => {
    const plan = planAttach(await currentActivityTags(tx, activity.id), tag);
    if (!plan.changed) return plan;

    if (plan.replacedTagIds.length > 0) {
      await tx.activityTag.deleteMany({ where: { activityId: activity.id, tagId: { in: plan.replacedTagIds } } });
    }
    await tx.activityTag.create({ data: { activityId: activity.id, tagId: tag.id, createdById: actorId } });
    await audit(tx, {
      actorId,
      action: "activity.tag",
      entity: "Activity",
      entityId: activity.id,
      groupId: tag.groupId,
      meta: { tagId: tag.id, activityIds: [activity.id], replacedTagIds: plan.replacedTagIds },
    });
    return plan;
  });
}

export async function detachActivityTag(session: SessionUser, input: ActivityTagInput): Promise<DetachResult> {
  const activity = await resolveActivity(session, input.activityId);
  const tag = await resolveTag(session, input.tagId);
  authorize(session, "tag.use", { groupPath: tag.group.path });

  return db.$transaction(async (tx) => {
    const { count } = await tx.activityTag.deleteMany({ where: { activityId: activity.id, tagId: tag.id } });
    if (count === 0) return { changed: false };

    await audit(tx, {
      actorId: Number(session.id),
      action: "activity.untag",
      entity: "Activity",
      entityId: activity.id,
      groupId: tag.groupId,
      meta: { tagId: tag.id, activityIds: [activity.id], replacedTagIds: [] },
    });
    return { changed: true };
  });
}

export type BulkResult = { changed: number };

/**
 * Adds or removes one tag on up to a page of members. Every id is resolved and checked first, so a
 * single out-of-scope id (404) or one member over the cap rejects the batch; members for whom the
 * call would change nothing are skipped. One audit entry lists the members that changed.
 */
export async function bulkTagMembers(session: SessionUser, input: BulkTagMembersInput): Promise<BulkResult> {
  const tag = await resolveTag(session, input.tagId);
  authorize(session, "tag.use", { groupPath: tag.group.path });
  const members: Awaited<ReturnType<typeof resolveMember>>[] = [];
  for (const id of input.memberIds) members.push(await resolveMember(session, id));
  if (!members.every((member) => canTagMember(session, tag.group.path, member.group.path))) {
    throw new ValidationError(NOT_APPLICABLE);
  }

  const actorId = Number(session.id);
  const adding = input.op === "add";
  return db.$transaction(async (tx) => {
    const changedIds: number[] = [];
    const replacedLinks: { memberId: number; tagId: number }[] = [];

    for (const member of members) {
      const current = await currentMemberTags(tx, member.id);
      if (adding) {
        const plan = planAttach(current, tag);
        if (!plan.changed) continue;
        changedIds.push(member.id);
        for (const tagId of plan.replacedTagIds) replacedLinks.push({ memberId: member.id, tagId });
      } else if (current.some((t) => t.id === tag.id)) {
        changedIds.push(member.id);
      }
    }
    if (changedIds.length === 0) return { changed: 0 };

    if (replacedLinks.length > 0) {
      await tx.memberTag.deleteMany({ where: { OR: replacedLinks } });
    }
    if (adding) {
      await tx.memberTag.createMany({ data: changedIds.map((memberId) => ({ memberId, tagId: tag.id, createdById: actorId })) });
    } else {
      await tx.memberTag.deleteMany({ where: { tagId: tag.id, memberId: { in: changedIds } } });
    }
    await audit(tx, {
      actorId,
      action: adding ? "member.tag" : "member.untag",
      entity: "Member",
      groupId: tag.groupId,
      meta: { tagId: tag.id, memberIds: changedIds, replacedLinks },
    });
    return { changed: changedIds.length };
  });
}
