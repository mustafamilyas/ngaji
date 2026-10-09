import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import type { CheckInInput, CheckInMembersInput } from "@/lib/validation/attendance";
import { loadRecordingContext } from "./save";

/** Members of one leaf group who are expected on the date, with whether they are already marked present. */
export async function listCheckInMembers(session: SessionUser, input: CheckInMembersInput) {
  const { activity, occurrence, expectedMembers } = await loadRecordingContext(session, input);

  const row = await db.activityOccurrence.findUnique({
    where: { activityId_date: { activityId: activity.id, date: input.date } },
    include: { attendances: true },
  });
  const statusByMember = new Map((row?.attendances ?? []).map((a) => [a.memberId, a.status]));

  return {
    effectiveStartTime: occurrence.effectiveStartTime,
    members: expectedMembers
      .map((m) => ({ id: m.id, name: m.name, checkedIn: statusByMember.get(m.id) === "HADIR" }))
      .sort((a, b) => a.name.localeCompare(b.name, "id-ID")),
  };
}

/**
 * Marks one member HADIR without touching anyone else's attendance (unlike
 * `saveAttendance`, which replaces the whole list). Idempotent: checking in
 * twice keeps one row and reports `alreadyCheckedIn`.
 */
export async function checkInMember(session: SessionUser, input: CheckInInput) {
  const { activity, leafGroup, expectedMembers } = await loadRecordingContext(session, input);

  const member = expectedMembers.find((m) => m.id === input.memberId);
  if (!member) throw new ValidationError("Anggota tidak terdaftar di grup ini atau tidak diharapkan hadir");

  return db.$transaction(async (tx) => {
    const occurrenceRow = await tx.activityOccurrence.upsert({
      where: { activityId_date: { activityId: activity.id, date: input.date } },
      create: { activityId: activity.id, date: input.date },
      update: {},
    });
    const existing = await tx.attendance.findUnique({
      where: { occurrenceId_memberId: { occurrenceId: occurrenceRow.id, memberId: member.id } },
    });
    const alreadyCheckedIn = existing?.status === "HADIR";

    if (!alreadyCheckedIn) {
      await tx.attendance.upsert({
        where: { occurrenceId_memberId: { occurrenceId: occurrenceRow.id, memberId: member.id } },
        create: { occurrenceId: occurrenceRow.id, memberId: member.id, status: "HADIR", recordedById: Number(session.id) },
        update: { status: "HADIR", recordedById: Number(session.id) },
      });
      await audit(tx, {
        actorId: Number(session.id),
        action: "attendance.save",
        entity: "ActivityOccurrence",
        entityId: occurrenceRow.id,
        groupId: leafGroup.id,
        meta: { date: input.date, groupId: leafGroup.id, set: [{ memberId: member.id, status: "HADIR" }], removed: [] },
      });
    }

    return { memberName: member.name, groupName: leafGroup.name, alreadyCheckedIn };
  });
}
