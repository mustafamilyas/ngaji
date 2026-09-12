import { occurrencesFor } from "@/lib/activity/occurrences";
import { loadOccurrenceRows } from "@/lib/activity/rows";
import { toActivityTemplate } from "@/lib/activity/template";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { today } from "@/lib/dates";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getMaxDepth } from "@/lib/group/levels";
import { resolveActivity, resolveGroup } from "@/lib/resolve";
import { expected } from "@/lib/stats";
import type { AttendanceSaveInput } from "@/lib/validation/attendance";
import type { MemberStatus } from "@/lib/validation/enums";

/**
 * Bulk attendance save (DESIGN.md §3.3 "Absensi", §5.6): all six
 * `canRecordAttendance` conditions, one transaction (upsert occurrence,
 * then upsert/delete `Attendance` per member), one `attendance.save` audit
 * entry. Any invalid `memberId` fails the entire save — nothing is written.
 */
export async function saveAttendance(session: SessionUser, input: AttendanceSaveInput) {
  const activity = await resolveActivity(session, input.activityId);
  const leafGroup = await resolveGroup(session, input.groupId);
  const maxDepth = await getMaxDepth(leafGroup.organizationId);
  const isLeaf = leafGroup.depth === maxDepth;
  if (!isLeaf) {
    throw new ValidationError("Grup untuk absensi harus grup daun");
  }

  authorize(session, "attendance.record", {
    activityGroupPath: activity.group.path,
    leafGroupPath: leafGroup.path,
    isLeaf,
  });

  const template = toActivityTemplate(activity);
  const rows = await loadOccurrenceRows(activity.id, input.date, input.date);
  const occurrence = occurrencesFor(template, input.date, input.date, rows).find(
    (o) => o.key === input.date,
  );
  if (!occurrence) throw new NotFoundError();
  if (occurrence.effectiveDate > today()) {
    throw new ValidationError("Tidak bisa mengisi absensi untuk tanggal yang akan datang");
  }
  if (occurrence.status === "CANCELLED") {
    throw new ValidationError("Kegiatan pada tanggal ini dibatalkan");
  }

  const submittedIds = input.entries.map((e) => e.memberId);
  const uniqueSubmittedIds = new Set(submittedIds);
  const candidateMembers = await db.member.findMany({ where: { groupId: leafGroup.id, id: { in: submittedIds } } });
  if (candidateMembers.length !== uniqueSubmittedIds.size) {
    throw new ValidationError("Ada anggota yang tidak valid untuk grup ini");
  }

  const allMembers = await db.member.findMany({ where: { groupId: leafGroup.id } });
  const expectedMembers = expected(
    { effectiveDate: occurrence.effectiveDate },
    allMembers.map((m) => ({ ...m, status: m.status as MemberStatus })),
  );
  const expectedIds = new Set(expectedMembers.map((m) => m.id));
  for (const id of uniqueSubmittedIds) {
    if (!expectedIds.has(id)) {
      throw new ValidationError("Ada anggota yang tidak diharapkan hadir pada tanggal ini");
    }
  }

  return db.$transaction(async (tx) => {
    const occurrenceRow = await tx.activityOccurrence.upsert({
      where: { activityId_date: { activityId: activity.id, date: input.date } },
      create: { activityId: activity.id, date: input.date },
      update: {},
    });

    const existing = await tx.attendance.findMany({ where: { occurrenceId: occurrenceRow.id } });
    const existingByMember = new Map(existing.map((a) => [a.memberId, a]));
    const entryByMember = new Map(input.entries.map((e) => [e.memberId, e.status]));

    const set: { memberId: number; status: string }[] = [];
    const removed: number[] = [];

    for (const [memberId, status] of entryByMember) {
      await tx.attendance.upsert({
        where: { occurrenceId_memberId: { occurrenceId: occurrenceRow.id, memberId } },
        create: { occurrenceId: occurrenceRow.id, memberId, status, recordedById: Number(session.id) },
        update: { status, recordedById: Number(session.id) },
      });
      set.push({ memberId, status });
    }

    for (const member of expectedMembers) {
      if (!entryByMember.has(member.id) && existingByMember.has(member.id)) {
        await tx.attendance.delete({ where: { id: existingByMember.get(member.id)!.id } });
        removed.push(member.id);
      }
    }

    await audit(tx, {
      actorId: Number(session.id),
      action: "attendance.save",
      entity: "ActivityOccurrence",
      entityId: occurrenceRow.id,
      groupId: leafGroup.id,
      meta: { date: input.date, groupId: leafGroup.id, set, removed },
    });

    return { occurrence: occurrenceRow, set, removed };
  });
}
