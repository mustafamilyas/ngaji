import { toActivityTemplate } from "@/lib/activity/template";
import { findConflicts, type ConflictCandidate } from "@/lib/activity/conflicts";
import { occurrencesFor } from "@/lib/activity/occurrences";
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
  groupIds?: number[];
};

type RawEntry = Omit<ActivityListEntry, "hasConflict">;

/**
 * Occurrences of every activity applying to `filter.groupIds` (default the
 * caller's own group): for each selected group Y, `ancestors(Y) ∪ {Y} ∪
 * descendants(Y)` (DESIGN.md §5.3), unioned and de-duplicated by occurrence
 * across all selected groups. Each id is resolved and scope-checked
 * independently; an out-of-scope id is dropped rather than failing the
 * whole request. Conflict detection runs once over the combined candidate
 * set, so a conflict spanning two different selected groups is still caught.
 */
export async function listActivityOccurrences(session: SessionUser, filter: ListActivitiesFilter) {
  const requestedIds = filter.groupIds ?? [session.groupId];

  const targetGroups: { id: number; path: string; name: string }[] = [];
  const rawByKey = new Map<string, RawEntry>();
  const candidatesByKey = new Map<string, ConflictCandidate>();

  for (const id of requestedIds) {
    let targetGroup;
    try {
      targetGroup = await resolveGroup(session, id);
    } catch (error) {
      if (error instanceof NotFoundError) continue;
      throw error;
    }
    targetGroups.push(targetGroup);

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

    for (const activity of activities) {
      const rows = await loadOccurrenceRows(activity.id, filter.from, filter.to);
      const occurrences = occurrencesFor(toActivityTemplate(activity), filter.from, filter.to, rows);

      const group = groupById.get(activity.groupId)!;
      const inherited = isAncestorOf(group.path, targetGroup.path);
      const canEdit = canEditActivity(session, activity.groupId);
      const canRecord = isInScope(session.groupPath, group.path);

      for (const occurrence of occurrences) {
        const dedupeKey = `${activity.id}:${occurrence.key}`;

        candidatesByKey.set(dedupeKey, {
          id: dedupeKey,
          groupPath: group.path,
          effectiveDate: occurrence.effectiveDate,
          effectiveStartTime: occurrence.effectiveStartTime,
          effectiveDurationMinutes: occurrence.effectiveDurationMinutes,
          status: occurrence.status,
        });

        const existing = rawByKey.get(dedupeKey);
        if (!existing || (existing.inherited && !inherited)) {
          rawByKey.set(dedupeKey, {
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
            canEdit,
            canRecord,
          });
        }
      }
    }
  }

  if (targetGroups.length === 0) throw new NotFoundError();

  const conflictIds = new Set<string>();
  for (const conflict of findConflicts([...candidatesByKey.values()])) {
    conflictIds.add(conflict.a);
    conflictIds.add(conflict.b);
  }

  const entries: ActivityListEntry[] = [...rawByKey.values()].map((raw) => ({
    ...raw,
    hasConflict: conflictIds.has(`${raw.activityId}:${raw.key}`),
  }));

  entries.sort((a, b) =>
    a.effectiveDate === b.effectiveDate
      ? a.effectiveStartTime.localeCompare(b.effectiveStartTime)
      : a.effectiveDate.localeCompare(b.effectiveDate),
  );

  return { entries, groups: targetGroups };
}
