import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createActivity } from "@/lib/activity/mutations";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { addDays, today } from "@/lib/dates";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { saveAttendance } from "./save";

let actorId: number;

function sessionAt(role: SessionUser["role"], groupId: number, groupPath: string): SessionUser {
  return {
    id: String(actorId),
    username: "tester",
    name: "Tester",
    role,
    groupId,
    groupPath,
    mustChangePassword: false,
  };
}

async function makeMember(groupId: number, name: string) {
  return db.member.create({
    data: {
      groupId,
      name,
      birthPlace: "Jakarta",
      birthDate: "2000-01-01",
      sex: "L",
      address: "-",
      phone: "0800000000",
      maritalStatus: "BELUM_MENIKAH",
      workStatus: "BEKERJA",
      joinedAt: "2024-01-01",
      createdById: actorId,
    },
  });
}

describe("lib/attendance/save saveAttendance", () => {
  let daerah: { id: number; path: string };
  let kelompok: { id: number; path: string };
  let kelompokB: { id: number; path: string };
  let desa: { id: number; path: string };

  beforeAll(async () => {
    const actor = await db.user.create({
      data: { username: "attendance-save-actor", passwordHash: "x", name: "Actor" },
    });
    actorId = actor.id;

    const organization = await db.organization.create({ data: { name: "Attendance Save Test Org" } });
    for (const [depth, name] of ["Root", "Daerah", "Desa", "Kelompok"].entries()) {
      await db.level.create({ data: { organizationId: organization.id, depth, name } });
    }
    const rootRow = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "" },
    });
    const root = await db.group.update({ where: { id: rootRow.id }, data: { path: `${rootRow.id}/` } });

    const daerahRow = await db.group.create({
      data: { organizationId: organization.id, parentId: root.id, depth: 1, name: "Daerah", path: "" },
    });
    daerah = await db.group.update({
      where: { id: daerahRow.id },
      data: { path: `${root.path}${daerahRow.id}/` },
    });

    const desaRow = await db.group.create({
      data: { organizationId: organization.id, parentId: daerah.id, depth: 2, name: "Desa", path: "" },
    });
    desa = await db.group.update({ where: { id: desaRow.id }, data: { path: `${daerah.path}${desaRow.id}/` } });

    const kelompokRow = await db.group.create({
      data: { organizationId: organization.id, parentId: desa.id, depth: 3, name: "Kelompok", path: "" },
    });
    kelompok = await db.group.update({
      where: { id: kelompokRow.id },
      data: { path: `${desa.path}${kelompokRow.id}/` },
    });

    const kelompokBRow = await db.group.create({
      data: { organizationId: organization.id, parentId: desa.id, depth: 3, name: "Kelompok B", path: "" },
    });
    kelompokB = await db.group.update({
      where: { id: kelompokBRow.id },
      data: { path: `${desa.path}${kelompokBRow.id}/` },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("saves attendance when a USER below the owning group records for a daerah-owned activity", async () => {
    const daerahAdmin = sessionAt("ADMIN", daerah.id, daerah.path);
    const { activity } = await createActivity(daerahAdmin, {
      groupId: daerah.id,
      name: "Kajian Daerah",
      location: "A",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [1],
      startsOn: "2020-01-06",
    });

    const member = await makeMember(kelompok.id, "Anggota 1");
    const kelompokUser = sessionAt("USER", kelompok.id, kelompok.path);

    const date = pastMonday();
    const result = await saveAttendance(kelompokUser, {
      activityId: activity.id,
      groupId: kelompok.id,
      date,
      entries: [{ memberId: member.id, status: "HADIR" }],
    });

    expect(result.set).toEqual([{ memberId: member.id, status: "HADIR" }]);
  });

  it("throws ForbiddenError for an ADMIN above the owning group", async () => {
    const kelompokAdmin = sessionAt("ADMIN", kelompok.id, kelompok.path);
    const { activity } = await createActivity(kelompokAdmin, {
      groupId: kelompok.id,
      name: "Kajian Kelompok",
      location: "A",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [1],
      startsOn: "2020-01-06",
    });

    const daerahAdmin = sessionAt("ADMIN", daerah.id, daerah.path);
    await expect(
      saveAttendance(daerahAdmin, {
        activityId: activity.id,
        groupId: kelompok.id,
        date: pastMonday(),
        entries: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a non-leaf target group", async () => {
    const daerahAdmin = sessionAt("ADMIN", daerah.id, daerah.path);
    const { activity } = await createActivity(daerahAdmin, {
      groupId: daerah.id,
      name: "Kajian Non-Leaf",
      location: "A",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [1],
      startsOn: "2020-01-06",
    });

    await expect(
      saveAttendance(daerahAdmin, {
        activityId: activity.id,
        groupId: desa.id,
        date: pastMonday(),
        entries: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a future date", async () => {
    const kelompokUser = sessionAt("USER", kelompok.id, kelompok.path);
    const { activity } = await createActivity(sessionAt("ADMIN", kelompok.id, kelompok.path), {
      groupId: kelompok.id,
      name: "Kajian Masa Depan",
      location: "A",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [1],
      startsOn: "2020-01-06",
    });

    await expect(
      saveAttendance(kelompokUser, {
        activityId: activity.id,
        groupId: kelompok.id,
        date: futureMonday(),
        entries: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("responds 404 for a date the rule does not generate and that has no attendance", async () => {
    const kelompokUser = sessionAt("USER", kelompok.id, kelompok.path);
    const { activity } = await createActivity(sessionAt("ADMIN", kelompok.id, kelompok.path), {
      groupId: kelompok.id,
      name: "Kajian Tanggal Salah",
      location: "A",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [1],
      startsOn: "2020-01-06",
    });

    await expect(
      saveAttendance(kelompokUser, {
        activityId: activity.id,
        groupId: kelompok.id,
        // A Tuesday; the rule only generates Mondays.
        date: addDays(pastMonday(), 1),
        entries: [],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects the whole save when a memberId belongs to a sibling kelompok, writing nothing", async () => {
    const kelompokUser = sessionAt("USER", kelompok.id, kelompok.path);
    const { activity } = await createActivity(sessionAt("ADMIN", kelompok.id, kelompok.path), {
      groupId: kelompok.id,
      name: "Kajian Foreign Member",
      location: "A",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [1],
      startsOn: "2020-01-06",
    });

    const ownMember = await makeMember(kelompok.id, "Anggota Sendiri");
    const foreignMember = await makeMember(kelompokB.id, "Anggota Tetangga");

    const date = pastMonday();
    await expect(
      saveAttendance(kelompokUser, {
        activityId: activity.id,
        groupId: kelompok.id,
        date,
        entries: [
          { memberId: ownMember.id, status: "HADIR" },
          { memberId: foreignMember.id, status: "HADIR" },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const occurrence = await db.activityOccurrence.findUnique({
      where: { activityId_date: { activityId: activity.id, date } },
    });
    expect(occurrence).toBeNull();
  });

  it("deletes the row when a previously-present member is unchecked, in one audited save", async () => {
    const kelompokUser = sessionAt("USER", kelompok.id, kelompok.path);
    const { activity } = await createActivity(sessionAt("ADMIN", kelompok.id, kelompok.path), {
      groupId: kelompok.id,
      name: "Kajian Uncheck",
      location: "A",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [1],
      startsOn: "2020-01-06",
    });

    const memberA = await makeMember(kelompok.id, "Anggota A");
    const memberB = await makeMember(kelompok.id, "Anggota B");
    const date = pastMonday();

    await saveAttendance(kelompokUser, {
      activityId: activity.id,
      groupId: kelompok.id,
      date,
      entries: [
        { memberId: memberA.id, status: "HADIR" },
        { memberId: memberB.id, status: "IZIN" },
      ],
    });

    const result = await saveAttendance(kelompokUser, {
      activityId: activity.id,
      groupId: kelompok.id,
      date,
      entries: [{ memberId: memberA.id, status: "HADIR" }],
    });

    expect(result.removed).toEqual([memberB.id]);

    const occurrence = await db.activityOccurrence.findUnique({
      where: { activityId_date: { activityId: activity.id, date } },
    });
    const remaining = await db.attendance.findMany({ where: { occurrenceId: occurrence!.id } });
    expect(remaining.map((a) => a.memberId)).toEqual([memberA.id]);

    const entries = await db.auditLog.findMany({
      where: { action: "attendance.save", entityId: occurrence!.id },
    });
    const lastEntry = entries[entries.length - 1];
    expect(lastEntry.meta).toMatchObject({
      date,
      groupId: kelompok.id,
      set: [{ memberId: memberA.id, status: "HADIR" }],
      removed: [memberB.id],
    });
  });
});

/** A Monday in the past relative to `today()`, always a valid key for the WEEKLY(weekdays=[1]) fixtures above. */
function pastMonday(): string {
  const base = today();
  const weekday = new Date(`${base}T00:00:00Z`).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return addDays(base, -(daysSinceMonday === 0 ? 7 : daysSinceMonday));
}

/** The next Monday strictly after `today()` (1-7 days out). */
function futureMonday(): string {
  const base = today();
  const weekday = new Date(`${base}T00:00:00Z`).getUTCDay();
  const daysUntilNextMonday = ((1 - weekday + 7) % 7) || 7;
  return addDays(base, daysUntilNextMonday);
}
