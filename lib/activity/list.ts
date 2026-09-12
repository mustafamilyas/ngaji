import { toActivityTemplate } from "@/lib/activity/template";
import { findConflicts, type ConflictCandidate } from "@/lib/activity/conflicts";
import { occurrencesFor, type Occurrence } from "@/lib/activity/occurrences";
import { loadOccurrenceRows } from "@/lib/activity/rows";
import type { SessionUser } from "@/lib/auth/session-user";
import { canEditActivity } from "@/lib/authz";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { resolveGroup } from "@/lib/resolve";
import { ancestorPathsOf, isAncestorOf, isInScope } from "@/lib/scope";
import type { OccurrenceStatus } from "@/lib/validation/enums";

export type ActivityListEntry = {
  activityId: number;
  activityName: string;
  groupId: number;
  groupName: string;
  /** The rule-generated date — stable key, used in the attendance/detail URL. */
  key: string;
  effectiveDate: string;
  effectiveStartTime: string;
  effectiveDurationMinutes: number;
  effectiveLocation: string;
  effectiveNotes: string | null;
  status: OccurrenceStatus;
  /** Owned by an ancestor of the viewed group, not the group itself or a descendant. */
  inherited: boolean;
  moved: boolean;
  hasConflict: boolean;
  canEdit: boolean;
  canRecord: boolean;
};

export type ListActivitiesFilter = {
  from: string;
  to: string;
  groupId?: number;
};

/**
 * Occurrences of every activity applying to `filter.groupId` (default the
 * caller's own group): `ancestors(Y) ∪ {Y} ∪ descendants(Y)` (DESIGN.md §5.3).
 */
export async function listActivityOccurrences(session: SessionUser, filter: ListActivitiesFilter) {
  const targetGroup =
    filter.groupId !== undefined
      ? await resolveGroup(session, filter.groupId)
      : await db.group.findUnique({ where: { id: session.groupId } });
  if (!targetGroup) throw new NotFoundError();

  const relatedGroups = await db.group.findMany({
    where: {
      OR: [{ path: { in: ancestorPathsOf(targetGroup.path) } }, { path: { startsWith: targetGroup.path } }],
    },
    select: { id: true, path: true, name: true },
  });
  const groupById = new Map(relatedGroups.map((g) => [g.id, g]));

  const activities = await db.activity.findMany({
    where: { groupId: { in: relatedGroups.map((g) => g.id) } },
  });

  const occurrencesByActivity = new Map<number, Occurrence[]>();
  const candidates: ConflictCandidate[] = [];

  for (const activity of activities) {
    const rows = await loadOccurrenceRows(activity.id, filter.from, filter.to);
    const occurrences = occurrencesFor(toActivityTemplate(activity), filter.from, filter.to, rows);
    occurrencesByActivity.set(activity.id, occurrences);

    const groupPath = groupById.get(activity.groupId)!.path;
    for (const occurrence of occurrences) {
      candidates.push({
        id: `${activity.id}:${occurrence.key}`,
        groupPath,
        effectiveDate: occurrence.effectiveDate,
        effectiveStartTime: occurrence.effectiveStartTime,
        effectiveDurationMinutes: occurrence.effectiveDurationMinutes,
        status: occurrence.status,
      });
    }
  }

  const conflictIds = new Set<string>();
  for (const conflict of findConflicts(candidates)) {
    conflictIds.add(conflict.a);
    conflictIds.add(conflict.b);
  }

  const entries: ActivityListEntry[] = [];
  for (const activity of activities) {
    const group = groupById.get(activity.groupId)!;
    const inherited = isAncestorOf(group.path, targetGroup.path);
    const canEdit = canEditActivity(session, activity.groupId);
    const canRecord = isInScope(session.groupPath, group.path);

    for (const occurrence of occurrencesByActivity.get(activity.id)!) {
      entries.push({
        activityId: activity.id,
        activityName: activity.name,
        groupId: group.id,
        groupName: group.name,
        key: occurrence.key,
        effectiveDate: occurrence.effectiveDate,
        effectiveStartTime: occurrence.effectiveStartTime,
        effectiveDurationMinutes: occurrence.effectiveDurationMinutes,
        effectiveLocation: occurrence.effectiveLocation,
        effectiveNotes: occurrence.effectiveNotes,
        status: occurrence.status,
        inherited,
        moved: occurrence.effectiveDate !== occurrence.key,
        hasConflict: conflictIds.has(`${activity.id}:${occurrence.key}`),
        canEdit,
        canRecord,
      });
    }
  }

  entries.sort((a, b) =>
    a.effectiveDate === b.effectiveDate
      ? a.effectiveStartTime.localeCompare(b.effectiveStartTime)
      : a.effectiveDate.localeCompare(b.effectiveDate),
  );

  return { entries, group: targetGroup };
}
