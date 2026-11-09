import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDays, today } from "@/lib/dates";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { buildPageFixture, sessionFor } from "@/lib/test/fixtures";
import { checkInMember, listCheckInMembers } from "./check-in";
import { DEFAULT_TIMEZONE } from "@/lib/validation/enums";

describe("lib/attendance/check-in", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("marks one member HADIR, keeps others untouched, and is idempotent", async () => {
    const f = await buildPageFixture("check-in-basic");
    const session = sessionFor(f.actorId, "OWNER", f.leaf);
    const other = await db.member.create({
      data: {
        groupId: f.leaf.id,
        name: "Anggota Lain",
        birthPlace: "Jakarta",
        birthDate: "2000-01-01",
        sex: "L",
        address: "-",
        phone: "0800000000",
        maritalStatus: "BELUM_MENIKAH",
        workStatus: "BEKERJA",
        joinedAt: "2024-01-01",
        createdById: f.actorId,
      },
    });
    const occurrence = await db.activityOccurrence.create({ data: { activityId: f.activityId, date: today(DEFAULT_TIMEZONE) } });
    await db.attendance.create({
      data: { occurrenceId: occurrence.id, memberId: other.id, status: "IZIN", recordedById: f.actorId },
    });

    const input = { activityId: f.activityId, groupId: f.leaf.id, date: today(DEFAULT_TIMEZONE), memberId: f.memberId };
    const first = await checkInMember(session, input);
    expect(first).toMatchObject({ memberName: "Anggota Uji", alreadyCheckedIn: false });
    const second = await checkInMember(session, input);
    expect(second.alreadyCheckedIn).toBe(true);

    const rows = await db.attendance.findMany({ where: { occurrenceId: occurrence.id } });
    expect(rows.map((r) => [r.memberId, r.status]).sort()).toEqual(
      [[f.memberId, "HADIR"], [other.id, "IZIN"]].sort(),
    );
    const logs = await db.auditLog.count({ where: { entityId: occurrence.id, action: "attendance.save" } });
    expect(logs).toBe(1);

    const listed = await listCheckInMembers(session, { activityId: f.activityId, groupId: f.leaf.id, date: today(DEFAULT_TIMEZONE) });
    expect(listed.members.find((m) => m.id === f.memberId)?.checkedIn).toBe(true);
    expect(listed.members.find((m) => m.id === other.id)?.checkedIn).toBe(false);
  });

  it("rejects a member that belongs to another group", async () => {
    const f = await buildPageFixture("check-in-other-group");
    const session = sessionFor(f.actorId, "OWNER", f.leaf);
    await expect(
      checkInMember(session, { activityId: f.activityId, groupId: f.leaf.id, date: today(DEFAULT_TIMEZONE), memberId: 999_999 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects non-leaf groups", async () => {
    const f = await buildPageFixture("check-in-guards");
    const session = sessionFor(f.actorId, "OWNER", f.leaf);
    await expect(
      checkInMember(session, { activityId: f.activityId, groupId: f.branch.id, date: today(DEFAULT_TIMEZONE), memberId: f.memberId }),
    ).rejects.toThrow();
  });

  describe("future dates (task 6.2)", () => {
    const future = () => addDays(today(DEFAULT_TIMEZONE), 7);

    it.each(["ADMIN", "OWNER"] as const)("lets an %s list and check in members for a future occurrence", async (role) => {
      const f = await buildPageFixture(`check-in-future-${role}`);
      const session = sessionFor(f.actorId, role, f.leaf);
      const input = { activityId: f.activityId, groupId: f.leaf.id, date: future() };

      const listed = await listCheckInMembers(session, input);
      expect(listed.members.map((m) => m.id)).toContain(f.memberId);
      await expect(checkInMember(session, { ...input, memberId: f.memberId })).resolves.toMatchObject({ alreadyCheckedIn: false });
      const row = await db.activityOccurrence.findUnique({
        where: { activityId_date: { activityId: f.activityId, date: future() } },
        include: { attendances: true },
      });
      expect(row?.attendances).toEqual([expect.objectContaining({ memberId: f.memberId, status: "HADIR" })]);
    });

    it("keeps a USER at today or earlier, even with an extra ADMIN role on the owning group", async () => {
      const f = await buildPageFixture("check-in-future-user");
      const input = { activityId: f.activityId, groupId: f.leaf.id, date: future() };
      const user = sessionFor(f.actorId, "USER", f.leaf);
      const userWithExtraAdmin = { ...user, extraRoles: [{ groupId: f.leaf.id, role: "ADMIN" as const }] };

      for (const session of [user, userWithExtraAdmin]) {
        await expect(listCheckInMembers(session, input)).rejects.toBeInstanceOf(ValidationError);
        await expect(checkInMember(session, { ...input, memberId: f.memberId })).rejects.toBeInstanceOf(ValidationError);
      }
    });
  });

  it("404s for groups outside the caller's scope and forbids users above the activity's group", async () => {
    const f = await buildPageFixture("check-in-scope");
    const leafUser = sessionFor(f.actorId, "USER", f.leaf);
    await expect(
      checkInMember(leafUser, { activityId: f.activityId, groupId: f.otherLeaf.id, date: today(DEFAULT_TIMEZONE), memberId: f.memberId }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const rootUser = sessionFor(f.actorId, "OWNER", f.root);
    await expect(
      checkInMember(rootUser, { activityId: f.activityId, groupId: f.leaf.id, date: today(DEFAULT_TIMEZONE), memberId: f.memberId }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
