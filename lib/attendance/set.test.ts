import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDays, today } from "@/lib/dates";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { buildPageFixture, sessionFor } from "@/lib/test/fixtures";
import { setMemberAttendance } from "./set";

async function attendanceOf(activityId: number, date: string, memberId: number) {
  const occurrence = await db.activityOccurrence.findUnique({ where: { activityId_date: { activityId, date } } });
  if (!occurrence) return null;
  return db.attendance.findUnique({ where: { occurrenceId_memberId: { occurrenceId: occurrence.id, memberId } } });
}

describe("lib/attendance/set setMemberAttendance", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("sets HADIR, switches to IZIN with a reason, drops the reason on HADIR, and clears", async () => {
    const f = await buildPageFixture("set-attendance-cycle");
    const session = sessionFor(f.actorId, "USER", f.leaf);
    const base = { activityId: f.activityId, date: today(), memberId: f.memberId };

    await setMemberAttendance(session, { ...base, status: "HADIR" });
    expect(await attendanceOf(f.activityId, today(), f.memberId)).toMatchObject({ status: "HADIR", note: null });

    const izin = await setMemberAttendance(session, { ...base, status: "IZIN", note: "Sakit" });
    expect(izin).toMatchObject({ status: "IZIN", note: "Sakit" });
    expect(await attendanceOf(f.activityId, today(), f.memberId)).toMatchObject({ status: "IZIN", note: "Sakit" });

    await setMemberAttendance(session, { ...base, status: "HADIR", note: "ignored" });
    expect(await attendanceOf(f.activityId, today(), f.memberId)).toMatchObject({ status: "HADIR", note: null });

    await setMemberAttendance(session, { ...base, status: null });
    expect(await attendanceOf(f.activityId, today(), f.memberId)).toBeNull();
  });

  it("audits each change once and skips no-ops", async () => {
    const f = await buildPageFixture("set-attendance-audit");
    const session = sessionFor(f.actorId, "USER", f.leaf);
    const base = { activityId: f.activityId, date: today(), memberId: f.memberId };

    await setMemberAttendance(session, { ...base, status: "IZIN", note: "Mudik" });
    await setMemberAttendance(session, { ...base, status: "IZIN", note: "Mudik" });
    await setMemberAttendance(session, { ...base, status: null });

    const occurrence = await db.activityOccurrence.findUniqueOrThrow({
      where: { activityId_date: { activityId: f.activityId, date: today() } },
    });
    const logs = await db.auditLog.findMany({
      where: { entityId: occurrence.id, action: "attendance.save" },
      orderBy: { id: "asc" },
    });
    expect(logs.map((l) => l.meta)).toEqual([
      { date: today(), groupId: f.leaf.id, set: [{ memberId: f.memberId, status: "IZIN", note: "Mudik" }], removed: [] },
      { date: today(), groupId: f.leaf.id, set: [], removed: [f.memberId] },
    ]);
  });

  it("lets an ADMIN record a future date but not a USER", async () => {
    const f = await buildPageFixture("set-attendance-future");
    const future = addDays(today(), 7);
    const input = { activityId: f.activityId, date: future, memberId: f.memberId, status: "IZIN" as const, note: "Dinas" };

    await expect(setMemberAttendance(sessionFor(f.actorId, "USER", f.leaf), input)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await setMemberAttendance(sessionFor(f.actorId, "ADMIN", f.leaf), input);
    expect(await attendanceOf(f.activityId, future, f.memberId)).toMatchObject({ status: "IZIN", note: "Dinas" });
  });

  it("refuses a cancelled occurrence even for an ADMIN", async () => {
    const f = await buildPageFixture("set-attendance-cancelled");
    await db.activityOccurrence.create({ data: { activityId: f.activityId, date: today(), status: "CANCELLED" } });
    await expect(
      setMemberAttendance(sessionFor(f.actorId, "ADMIN", f.leaf), {
        activityId: f.activityId,
        date: today(),
        memberId: f.memberId,
        status: "HADIR",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("forbids users above the owning group and 404s members outside the caller's scope", async () => {
    const f = await buildPageFixture("set-attendance-scope");
    const input = { activityId: f.activityId, date: today(), memberId: f.memberId, status: "HADIR" as const };

    await expect(setMemberAttendance(sessionFor(f.actorId, "OWNER", f.branch), input)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(setMemberAttendance(sessionFor(f.actorId, "ADMIN", f.otherLeaf), input)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
