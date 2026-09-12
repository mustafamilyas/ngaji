import { z } from "zod";
import { ACTIVITY_DATE_RE } from "./activity";
import { ATTENDANCE_STATUSES } from "./enums";

/** Bulk save for one occurrence (DESIGN.md §5.6): the full set of present members, keyed by leaf group `groupId` (Y) and rule `date` (X). */
export const attendanceSaveSchema = z.object({
  activityId: z.coerce.number().int().positive(),
  groupId: z.coerce.number().int().positive(),
  date: z.string().regex(ACTIVITY_DATE_RE, "Tanggal tidak valid"),
  entries: z.array(
    z.object({
      memberId: z.coerce.number().int().positive(),
      status: z.enum(ATTENDANCE_STATUSES),
    }),
  ),
});
export type AttendanceSaveInput = z.infer<typeof attendanceSaveSchema>;
