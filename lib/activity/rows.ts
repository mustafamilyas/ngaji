import type { OccurrenceRow } from "@/lib/activity/occurrences";
import { db } from "@/lib/db";
import type { OccurrenceStatus } from "@/lib/validation/enums";

/** `ActivityOccurrence` rows in `[from,to]` by rule date or override date, shaped for `occurrencesFor`. */
export async function loadOccurrenceRows(activityId: number, from: string, to: string): Promise<OccurrenceRow[]> {
  const rows = await db.activityOccurrence.findMany({
    where: { activityId, OR: [{ date: { gte: from, lte: to } }, { overrideDate: { gte: from, lte: to } }] },
    include: { attendances: { select: { id: true }, take: 1 } },
  });
  return rows.map((row) => ({
    date: row.date,
    status: row.status as OccurrenceStatus,
    overrideDate: row.overrideDate,
    overrideStartTime: row.overrideStartTime,
    overrideDurationMinutes: row.overrideDurationMinutes,
    overrideLocation: row.overrideLocation,
    overrideNotes: row.overrideNotes,
    hasAttendance: row.attendances.length > 0,
  }));
}
