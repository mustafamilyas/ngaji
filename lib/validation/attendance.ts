import { z } from "zod";
import { MAX_ATTENDANCE_ENTRIES, MAX_ATTENDANCE_NOTE_LENGTH } from "@/lib/constants";
import { dateSchema } from "./common";
import { ATTENDANCE_STATUSES } from "./enums";

/** Bulk save for one occurrence (DESIGN.md §5.6): the full set of present members, keyed by leaf group `groupId` (Y) and rule `date` (X). */
export const attendanceSaveSchema = z.object({
  activityId: z.coerce.number().int().positive(),
  groupId: z.coerce.number().int().positive(),
  date: dateSchema(),
  entries: z.array(
    z.object({
      memberId: z.coerce.number().int().positive(),
      status: z.enum(ATTENDANCE_STATUSES),
    }),
  ).max(MAX_ATTENDANCE_ENTRIES),
});
export type AttendanceSaveInput = z.infer<typeof attendanceSaveSchema>;

/** Single self check-in: one member marked HADIR (the kiosk page at `/dashboard/kegiatan/[id]/[tanggal]/absen`). */
export const checkInSchema = z.object({
  activityId: z.coerce.number().int().positive(),
  groupId: z.coerce.number().int().positive(),
  date: dateSchema(),
  memberId: z.coerce.number().int().positive(),
});
export type CheckInInput = z.infer<typeof checkInSchema>;

/**
 * One member's attendance set from the attendance table: `status: null`
 * clears it (absent), `note` is the IZIN reason and is dropped for HADIR.
 * The leaf group is the member's own, resolved on the server.
 */
export const attendanceSetSchema = z.object({
  activityId: z.coerce.number().int().positive(),
  date: dateSchema(),
  memberId: z.coerce.number().int().positive(),
  status: z.enum(ATTENDANCE_STATUSES).nullable(),
  note: z
    .string()
    .trim()
    .max(MAX_ATTENDANCE_NOTE_LENGTH, `Alasan maksimal ${MAX_ATTENDANCE_NOTE_LENGTH} karakter`)
    .optional(),
});
export type AttendanceSetInput = z.infer<typeof attendanceSetSchema>;

export const checkInMembersSchema = checkInSchema.omit({ memberId: true });
export type CheckInMembersInput = z.infer<typeof checkInMembersSchema>;
