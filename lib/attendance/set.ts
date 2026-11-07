import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { resolveMember } from "@/lib/resolve";
import type { AttendanceSetInput } from "@/lib/validation/attendance";
import { loadRecordingContext } from "./save";

/**
 * Sets one member's attendance from the attendance table without touching
 * anyone else's: HADIR, IZIN (with an optional reason) or `null` to clear.
 * The leaf group is the member's own — resolved here, never taken from the
 * client — and goes through the same `loadRecordingContext` checks as the
 * bulk save and check-in, including the future-date rule. A no-op (same status and note) writes nothing.
 */
export async function setMemberAttendance(session: SessionUser, input: AttendanceSetInput) {
  const resolved = await resolveMember(session, input.memberId);
  const { activity, leafGroup, expectedMembers } = await loadRecordingContext(
    session,
    { activityId: input.activityId, groupId: resolved.groupId, date: input.date },
  );

  const member = expectedMembers.find((m) => m.id === resolved.id);
  if (!member) throw new ValidationError("Anggota tidak diharapkan hadir pada tanggal ini");

  const status = input.status;
  const note = status === "IZIN" ? input.note || null : null;

  return db.$transaction(async (tx) => {
    const occurrenceRow = await tx.activityOccurrence.upsert({
      where: { activityId_date: { activityId: activity.id, date: input.date } },
      create: { activityId: activity.id, date: input.date },
      update: {},
    });
    const key = { occurrenceId_memberId: { occurrenceId: occurrenceRow.id, memberId: member.id } };
    const existing = await tx.attendance.findUnique({ where: key });

    const unchanged = status === null ? !existing : existing?.status === status && existing.note === note;
    if (unchanged) return { memberId: member.id, status, note };

    if (status === null) {
      await tx.attendance.delete({ where: key });
    } else {
      await tx.attendance.upsert({
        where: key,
        create: { occurrenceId: occurrenceRow.id, memberId: member.id, status, note, recordedById: Number(session.id) },
        update: { status, note, recordedById: Number(session.id) },
      });
    }

    await audit(tx, {
      actorId: Number(session.id),
      action: "attendance.save",
      entity: "ActivityOccurrence",
      entityId: occurrenceRow.id,
      groupId: leafGroup.id,
      meta: {
        date: input.date,
        groupId: leafGroup.id,
        set: status === null ? [] : [{ memberId: member.id, status, ...(note && { note }) }],
        removed: status === null ? [member.id] : [],
      },
    });

    return { memberId: member.id, status, note };
  });
}
