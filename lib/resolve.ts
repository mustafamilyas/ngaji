import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { isAncestorOf, isInScope } from "@/lib/scope";
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
    include: { role: { include: { group: true } } },
  });
  if (!user || !user.role || !isInScope(user.role.group.path, session.groupPath)) {
    throw new NotFoundError();
  }
  return user;
}
