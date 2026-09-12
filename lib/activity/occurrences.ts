import { expandDates, type ActivityRule } from "./expand";
import type { OccurrenceStatus } from "../validation/enums";

/** Activity fields needed to compute occurrence defaults. See DESIGN.md §5.2. */
export type ActivityTemplate = ActivityRule & {
  startTime: string;
  durationMinutes: number;
  location: string;
  notes: string | null;
};

/** The subset of an `ActivityOccurrence` row relevant to merging. */
export type OccurrenceRow = {
  date: string;
  status: OccurrenceStatus;
  overrideDate: string | null;
  overrideStartTime: string | null;
  overrideDurationMinutes: number | null;
  overrideLocation: string | null;
  overrideNotes: string | null;
  /** Whether at least one Attendance row exists for this occurrence. */
  hasAttendance: boolean;
};

export type Occurrence = {
  /** The rule-generated date; stable key used in URLs. */
  key: string;
  effectiveDate: string;
  effectiveStartTime: string;
  effectiveDurationMinutes: number;
  effectiveLocation: string;
  effectiveNotes: string | null;
  status: OccurrenceStatus;
};

/**
 * Union of rule-generated dates and rows with attendance, with overrides applied.
 * See DESIGN.md §5.2 and the `activity-scheduling` spec.
 */
export function occurrencesFor(
  activity: ActivityTemplate,
  from: string,
  to: string,
  rows: OccurrenceRow[],
): Occurrence[] {
  const rowsByDate = new Map(rows.map((r) => [r.date, r]));

  const keys = new Set(expandDates(activity, from, to));
  for (const r of rows) {
    if (r.hasAttendance) {
      keys.add(r.date);
    }
  }

  const result: Occurrence[] = [];
  for (const key of keys) {
    const row = rowsByDate.get(key);
    const effectiveDate = row?.overrideDate ?? key;
    if (effectiveDate < from || effectiveDate > to) {
      continue;
    }
    result.push({
      key,
      effectiveDate,
      effectiveStartTime: row?.overrideStartTime ?? activity.startTime,
      effectiveDurationMinutes: row?.overrideDurationMinutes ?? activity.durationMinutes,
      effectiveLocation: row?.overrideLocation ?? activity.location,
      effectiveNotes: row?.overrideNotes ?? activity.notes,
      status: row?.status ?? "SCHEDULED",
    });
  }

  return result.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}
