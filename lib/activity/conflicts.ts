import type { OccurrenceStatus } from "../validation/enums";

/** One occurrence's schedule, as seen from conflict detection. See DESIGN.md §5.4. */
export type ConflictCandidate = {
  id: string;
  /** The owning activity's group materialized path, e.g. "1/5/12/". */
  groupPath: string;
  effectiveDate: string;
  effectiveStartTime: string;
  effectiveDurationMinutes: number;
  status: OccurrenceStatus;
};

export type Conflict = { a: string; b: string };

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Ancestor, self, or descendant — never a sibling branch. */
function relatedGroups(pathA: string, pathB: string): boolean {
  return pathA.startsWith(pathB) || pathB.startsWith(pathA);
}

/**
 * Flags occurrence pairs that overlap in time on the same date within a related
 * group lineage. Warning only — never blocks saving. See DESIGN.md §5.4.
 */
export function findConflicts(candidates: ConflictCandidate[]): Conflict[] {
  const conflicts: Conflict[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i];
    if (a.status !== "SCHEDULED") continue;

    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j];
      if (b.status !== "SCHEDULED") continue;
      if (a.effectiveDate !== b.effectiveDate) continue;
      if (!relatedGroups(a.groupPath, b.groupPath)) continue;

      const aStart = toMinutes(a.effectiveStartTime);
      const aEnd = aStart + a.effectiveDurationMinutes;
      const bStart = toMinutes(b.effectiveStartTime);
      const bEnd = bStart + b.effectiveDurationMinutes;

      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push({ a: a.id, b: b.id });
      }
    }
  }

  return conflicts;
}
