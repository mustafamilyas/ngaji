import { toActivityTemplate } from "@/lib/activity/template";
import { findConflicts, type ConflictCandidate } from "@/lib/activity/conflicts";
import { occurrencesFor } from "@/lib/activity/occurrences";
import { loadOccurrenceRows } from "@/lib/activity/rows";
import { CONFLICT_HORIZON_DAYS } from "@/lib/constants";
import { addDays, today } from "@/lib/dates";
import { db } from "@/lib/db";
import { ancestorPathsOf } from "@/lib/scope";

/**
 * Warning-only conflict check on save (DESIGN.md §5.4): every occurrence of
 * `activityId` in the next `CONFLICT_HORIZON_DAYS` days, checked against
 * every occurrence of every activity owned by an ancestor, self, or
 * descendant of its group in the same window. Never blocks saving.
 */
export async function activityHasConflict(activityId: number, groupPath: string): Promise<boolean> {
  const from = today();
  const to = addDays(from, CONFLICT_HORIZON_DAYS);

  const relatedGroups = await db.group.findMany({
    where: {
      OR: [{ path: { in: ancestorPathsOf(groupPath) } }, { path: { startsWith: groupPath } }],
    },
    select: { id: true, path: true },
  });

  const relatedActivities = await db.activity.findMany({
    where: { groupId: { in: relatedGroups.map((g) => g.id) } },
    include: { group: { select: { path: true } } },
  });

  const candidates: ConflictCandidate[] = [];
  for (const activity of relatedActivities) {
    const rows = await loadOccurrenceRows(activity.id, from, to);
    const occurrences = occurrencesFor(toActivityTemplate(activity), from, to, rows);
    for (const occurrence of occurrences) {
      candidates.push({
        id: `${activity.id}:${occurrence.key}`,
        groupPath: activity.group.path,
        effectiveDate: occurrence.effectiveDate,
        effectiveStartTime: occurrence.effectiveStartTime,
        effectiveDurationMinutes: occurrence.effectiveDurationMinutes,
        status: occurrence.status,
      });
    }
  }

  const conflicts = findConflicts(candidates);
  const prefix = `${activityId}:`;
  return conflicts.some((c) => c.a.startsWith(prefix) || c.b.startsWith(prefix));
}
