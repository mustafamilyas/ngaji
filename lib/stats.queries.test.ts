import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createActivity } from "@/lib/activity/mutations";
import { overrideOccurrence } from "@/lib/activity/occurrence-mutations";
import { saveAttendance } from "@/lib/attendance/save";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { addDays, today } from "@/lib/dates";
import { activityStatistics, memberStatistics, participationStatistics } from "./stats";

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

async function makeMember(groupId: number, overrides: Partial<Record<string, unknown>> = {}) {
  return db.member.create({
    data: {
      groupId,
      name: "Anggota",
      birthPlace: "Jakarta",
      birthDate: "2000-01-01",
      sex: "L",
      address: "-",
      phone: "0800000000",
      maritalStatus: "BELUM_MENIKAH",
      workStatus: "BEKERJA",
      joinedAt: "2020-01-01",
      createdById: actorId,
      ...overrides,
    },
  });
}

describe("lib/stats DB-backed statistics", () => {
  let leaf: { id: number; path: string };
  let session: SessionUser;

  beforeAll(async () => {
    const actor = await db.user.create({
      data: { username: "stats-queries-actor", passwordHash: "x", name: "Actor" },
    });
    actorId = actor.id;

    const organization = await db.organization.create({ data: { name: "Stats Queries Test Org" } });
    for (const [depth, name] of ["Root", "Leaf"].entries()) {
      await db.level.create({ data: { organizationId: organization.id, depth, name } });
    }
    const rootRow = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "" },
    });
    const root = await db.group.update({ where: { id: rootRow.id }, data: { path: `${rootRow.id}/` } });

    const leafRow = await db.group.create({
      data: { organizationId: organization.id, parentId: root.id, depth: 1, name: "Leaf", path: "" },
    });
    leaf = await db.group.update({ where: { id: leafRow.id }, data: { path: `${root.path}${leafRow.id}/` } });

    session = sessionAt("ADMIN", leaf.id, leaf.path);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("memberStatistics", () => {
    it("counts a member turning 60 today in the lansia (>=60) bracket", async () => {
      const birthDate = addDays(today(), -60 * 365 - 15); // comfortably >= 60 years ago
      await makeMember(leaf.id, { name: "Lansia Uji", birthDate });

      const stats = await memberStatistics(session, leaf.id);
      expect(stats.byAgeBracket.lansia).toBeGreaterThanOrEqual(1);
    });
  });

  describe("activityStatistics", () => {
    it("excludes a cancelled occurrence from the statistics", async () => {
      const { activity } = await createActivity(session, {
        groupId: leaf.id,
        name: "Kajian Batal",
        location: "A",
        startTime: "19:00",
        durationMinutes: 60,
        freq: "ONCE",
        interval: 1,
        weekdays: [],
        startsOn: "2026-01-10",
        endsOn: "2026-01-10",
      });
      await overrideOccurrence(session, { activityId: activity.id, date: "2026-01-10", status: "CANCELLED" });

      const stats = await activityStatistics(session, { from: "2026-01-01", to: "2026-01-31", groupId: leaf.id });
      expect(stats.occurrences.some((o) => o.activityId === activity.id)).toBe(false);
    });

    it("keeps percentHadir at or below 100 when an attendee has since left", async () => {
      const member = await makeMember(leaf.id, { name: "Sudah Keluar" });
      const { activity } = await createActivity(session, {
        groupId: leaf.id,
        name: "Kajian Leaver",
        location: "A",
        startTime: "19:00",
        durationMinutes: 60,
        freq: "ONCE",
        interval: 1,
        weekdays: [],
        startsOn: "2026-01-15",
        endsOn: "2026-01-15",
      });
      await saveAttendance(session, {
        activityId: activity.id,
        groupId: leaf.id,
        date: "2026-01-15",
        entries: [{ memberId: member.id, status: "HADIR" }],
      });

      await db.member.update({
        where: { id: member.id },
        data: { status: "KELUAR", exitedAt: "2026-06-01" },
      });

      const stats = await activityStatistics(session, { from: "2026-01-01", to: "2026-01-31", groupId: leaf.id });
      const stat = stats.occurrences.find((o) => o.activityId === activity.id)!;
      expect(stat.expected).toBeGreaterThanOrEqual(stat.hadir);
      expect(stat.percentHadir).toBeLessThanOrEqual(100);
    });
  });

  describe("participationStatistics", () => {
    it("bounds each member's occurrence count to [max(from, joinedAt), min(to, exitedAt ?? today)]", async () => {
      const lateJoiner = await makeMember(leaf.id, { name: "Baru Gabung", joinedAt: "2026-02-15" });
      await createActivity(session, {
        groupId: leaf.id,
        name: "Kajian Mingguan Partisipasi",
        location: "A",
        startTime: "19:00",
        durationMinutes: 60,
        freq: "WEEKLY",
        interval: 1,
        weekdays: [0],
        startsOn: "2026-02-01",
      });
      const rows = await participationStatistics(session, { from: "2026-02-01", to: "2026-02-28", groupId: leaf.id });
      const row = rows.find((r) => r.memberId === lateJoiner.id)!;

      // Sundays in Feb 2026: 01, 08, 15, 22 — only 15 and 22 are on/after joinedAt (2026-02-15).
      expect(row.occurrenceCount).toBe(2);
    });
  });
});
