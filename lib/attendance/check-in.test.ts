import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { today } from "@/lib/dates";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { buildPageFixture, sessionFor } from "@/lib/test/fixtures";
import { checkInMember, listCheckInMembers } from "./check-in";

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
    const occurrence = await db.activityOccurrence.create({ data: { activityId: f.activityId, date: today() } });
    await db.attendance.create({
      data: { occurrenceId: occurrence.id, memberId: other.id, status: "IZIN", recordedById: f.actorId },
    });

    const input = { activityId: f.activityId, groupId: f.leaf.id, date: today(), memberId: f.memberId };
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

    const listed = await listCheckInMembers(session, { activityId: f.activityId, groupId: f.leaf.id, date: today() });
    expect(listed.members.find((m) => m.id === f.memberId)?.checkedIn).toBe(true);
    expect(listed.members.find((m) => m.id === other.id)?.checkedIn).toBe(false);
  });

  it("rejects a member that belongs to another group", async () => {
    const f = await buildPageFixture("check-in-other-group");
    const session = sessionFor(f.actorId, "OWNER", f.leaf);
    await expect(
      checkInMember(session, { activityId: f.activityId, groupId: f.leaf.id, date: today(), memberId: 999_999 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects future dates and non-leaf groups", async () => {
    const f = await buildPageFixture("check-in-guards");
    const session = sessionFor(f.actorId, "OWNER", f.leaf);
    await expect(
      checkInMember(session, { activityId: f.activityId, groupId: f.branch.id, date: today(), memberId: f.memberId }),
    ).rejects.toThrow();
    await expect(
      checkInMember(session, { activityId: f.activityId, groupId: f.leaf.id, date: "2999-01-01", memberId: f.memberId }),
    ).rejects.toThrow();
  });

  it("404s for groups outside the caller's scope and forbids users above the activity's group", async () => {
    const f = await buildPageFixture("check-in-scope");
    const leafUser = sessionFor(f.actorId, "USER", f.leaf);
    await expect(
      checkInMember(leafUser, { activityId: f.activityId, groupId: f.otherLeaf.id, date: today(), memberId: f.memberId }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const rootUser = sessionFor(f.actorId, "OWNER", f.root);
    await expect(
      checkInMember(rootUser, { activityId: f.activityId, groupId: f.leaf.id, date: today(), memberId: f.memberId }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
