import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createActivity } from "@/lib/activity/mutations";
import { overrideOccurrence } from "@/lib/activity/occurrence-mutations";
import { saveAttendance } from "@/lib/attendance/save";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { buildPageFixture, sessionFor, type PageFixture } from "@/lib/test/fixtures";
import { addDays, today } from "@/lib/dates";
import { toActivityTemplate } from "@/lib/activity/template";
import { resolveBreakdown } from "@/lib/summary/breakdown";
import { activityAttendanceSummary, activityStatistics, memberStatistics, participationStatistics } from "./stats";
import { DEFAULT_TIMEZONE } from "@/lib/validation/enums";

let actorId: number;

function sessionAt(role: SessionUser["role"], groupId: number, groupPath: string): SessionUser {
  return {
    id: String(actorId),
    username: "tester",
    name: "Tester",
    role,
    groupId,
    groupPath,
    organizationId: 0,
    timeZone: "Asia/Jakarta",
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
      const birthDate = addDays(today(DEFAULT_TIMEZONE), -60 * 365 - 15); // comfortably >= 60 years ago
      await makeMember(leaf.id, { name: "Lansia Uji", birthDate });

      const stats = await memberStatistics(session, leaf.id);
      expect(stats.byAgeBracket.lansia).toBeGreaterThanOrEqual(1);
    });
  });

  describe("memberStatistics breakdowns", () => {
    let fx: PageFixture;
    let viewer: SessionUser;
    let siblingTagId: number;
    let ownKeyTagId: number;
    let ownSimpleTagId: number;

    async function add(groupId: number, name: string, overrides: Record<string, unknown> = {}) {
      return db.member.create({
        data: {
          groupId, name, birthPlace: "Jakarta", birthDate: "2000-01-01", sex: "L", address: "-", phone: "0800000000",
          maritalStatus: "BELUM_MENIKAH", workStatus: "BEKERJA", joinedAt: "2020-01-01", createdById: fx.actorId,
          ...overrides,
        },
      });
    }
    const tag = (groupId: number, key: string, value: string | null, extra: Record<string, unknown> = {}) =>
      db.tag.create({ data: { groupId, key, value, color: "slate", createdById: fx.actorId, ...extra } });
    const link = (memberId: number, tagId: number) =>
      db.memberTag.create({ data: { memberId, tagId, createdById: fx.actorId } });

    beforeAll(async () => {
      fx = await buildPageFixture("stats-member-breakdowns");
      viewer = sessionFor(fx.actorId, "ADMIN", fx.branch);

      // In the branch scope: fixture member (L, AKTIF, leaf) + the members below.
      const perempuan = await add(fx.leaf.id, "Perempuan", { sex: "P", maritalStatus: "MENIKAH" });
      const tinggi = await tag(fx.branch.id, "prioritas", "tinggi");
      const rendah = await tag(fx.branch.id, "prioritas", "rendah");
      const simple = await tag(fx.branch.id, "relawan", null);
      ownKeyTagId = tinggi.id;
      ownSimpleTagId = simple.id;
      await link(perempuan.id, tinggi.id);
      await link(fx.memberId, rendah.id);
      await link(perempuan.id, simple.id);

      const other = await add(fx.otherLeaf.id, "Kelompok Lain", { workStatus: "PELAJAR_SMP" });
      await link(other.id, tinggi.id);
      await add(fx.leaf.id, "Pindah", { status: "PINDAH", exitedAt: "2025-01-01" });
      await add(fx.leaf.id, "Terhapus", { deletedAt: new Date() });

      // Outside the branch, and a tag the branch cannot see.
      const sibling = await tag(fx.otherLeaf.id, "rahasia", "x");
      siblingTagId = sibling.id;
      await link(other.id, sibling.id);
    });

    it("counts only AKTIF, non-deleted members in scope and every breakdown adds up to the total", async () => {
      const stats = await memberStatistics(viewer, fx.branch.id);
      expect(stats.total).toBe(3);
      const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
      expect(sum(stats.bySex)).toBe(3);
      expect(sum(stats.byMaritalStatus)).toBe(3);
      expect(sum(stats.byWorkStatus)).toBe(3);
      expect(sum(stats.byAgeBracket)).toBe(3);
      expect(stats.bySex).toMatchObject({ L: 2, P: 1 });
      expect(stats.byWorkStatus.PELAJAR_SMP).toBe(1);
    });

    it("keeps zero-count enum keys and age bracket labels", async () => {
      const stats = await memberStatistics(viewer, fx.branch.id);
      expect(Object.keys(stats.byAgeBracket)).toEqual(["balita", "anak", "remaja", "dewasa", "lansia"]);
      expect(stats.byMaritalStatus.CERAI_HIDUP).toBe(0);
    });

    it("lists every direct sub-group with its AKTIF count, empty ones included", async () => {
      const stats = await memberStatistics(viewer, fx.branch.id);
      expect(stats.byDirectSubGroup.map((g) => [g.groupName, g.count])).toEqual([
        ["Leaf", 2],
        ["Other Leaf", 1],
      ]);
    });

    it("has no tag breakdown unless a tag is asked for", async () => {
      expect((await memberStatistics(viewer, fx.branch.id)).byTag).toBeNull();
    });

    it("breaks down by a tag key, counting members without a value as Tanpa nilai", async () => {
      const stats = await memberStatistics(viewer, fx.branch.id, { tagId: ownKeyTagId });
      expect(stats.byTag?.label).toBe("prioritas");
      expect(stats.byTag?.buckets.map((b) => [b.label, b.count])).toEqual([
        ["rendah", 1],
        ["tinggi", 2],
        ["Tanpa nilai", 0],
      ]);
    });

    it("breaks down by a simple tag into Punya / Tidak punya", async () => {
      const stats = await memberStatistics(viewer, fx.branch.id, { tagId: ownSimpleTagId });
      expect(stats.byTag?.buckets.map((b) => [b.label, b.count])).toEqual([
        ["Punya", 1],
        ["Tidak punya", 2],
      ]);
    });

    it("ignores a tag the viewer cannot see", async () => {
      // A kelompok user cannot see a tag owned by the sibling kelompok.
      const leafViewer = sessionFor(fx.actorId, "ADMIN", fx.leaf);
      const stats = await memberStatistics(leafViewer, fx.leaf.id, { tagId: siblingTagId });
      expect(stats.byTag).toBeNull();
      expect(stats.total).toBe(2);
    });

    it("ignores an unknown or soft-deleted tag", async () => {
      expect((await memberStatistics(viewer, fx.branch.id, { tagId: 999999 })).byTag).toBeNull();
      const gone = await tag(fx.branch.id, "gone", null, { deletedAt: new Date() });
      expect((await memberStatistics(viewer, fx.branch.id, { tagId: gone.id })).byTag).toBeNull();
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

  describe("attendance breakdown (task 6.1)", () => {
    let fx: PageFixture;
    let viewer: SessionUser;
    let activityId: number;
    let tinggiId: number;
    let siblingTagId: number;
    const DAY = "2026-01-15";

    async function add(groupId: number, name: string, overrides: Record<string, unknown> = {}) {
      return db.member.create({
        data: {
          groupId, name, birthPlace: "Jakarta", birthDate: "2000-01-01", sex: "L", address: "-", phone: "0800000000",
          maritalStatus: "BELUM_MENIKAH", workStatus: "BEKERJA", joinedAt: "2020-01-01", createdById: fx.actorId,
          ...overrides,
        },
      });
    }
    const once = (name: string, date: string) => ({
      groupId: fx.leaf.id, name, location: "A", startTime: "19:00", durationMinutes: 60,
      freq: "ONCE" as const, interval: 1, weekdays: [], startsOn: date, endsOn: date,
    });

    beforeAll(async () => {
      fx = await buildPageFixture("stats-breakdown");
      viewer = sessionFor(fx.actorId, "ADMIN", fx.leaf);
      // The fixture's own member (L) plus 2 L and 2 P: 5 expected, 3 L and 2 P.
      const l1 = await add(fx.leaf.id, "L Satu");
      const l2 = await add(fx.leaf.id, "L Dua");
      const p1 = await add(fx.leaf.id, "P Satu", { sex: "P" });
      const p2 = await add(fx.leaf.id, "P Dua", { sex: "P" });
      const tinggi = await db.tag.create({ data: { groupId: fx.leaf.id, key: "prioritas", value: "tinggi", color: "slate", createdById: fx.actorId } });
      tinggiId = tinggi.id;
      await db.memberTag.create({ data: { memberId: l1.id, tagId: tinggi.id, createdById: fx.actorId } });
      siblingTagId = (await db.tag.create({ data: { groupId: fx.otherLeaf.id, key: "rahasia", value: "x", color: "slate", createdById: fx.actorId } })).id;

      const { activity } = await createActivity(viewer, once("Kajian Rincian", DAY));
      activityId = activity.id;
      await saveAttendance(viewer, {
        activityId, groupId: fx.leaf.id, date: DAY,
        entries: [
          { memberId: l1.id, status: "HADIR" },
          { memberId: l2.id, status: "IZIN" },
          { memberId: p1.id, status: "HADIR" },
          { memberId: p2.id, status: "HADIR" },
        ],
      });
      // A cancelled occurrence on another day contributes to no bucket.
      const { activity: cancelled } = await createActivity(viewer, once("Kajian Batal Rincian", "2026-01-20"));
      await overrideOccurrence(viewer, { activityId: cancelled.id, date: "2026-01-20", status: "CANCELLED" });
    });

    const range = { from: "2026-01-01", to: "2026-01-31" };

    it("is null without a breakdown", async () => {
      const stats = await activityStatistics(viewer, { ...range, groupId: fx.leaf.id });
      expect(stats.breakdown).toBeNull();
    });

    it("breaks expected / hadir / izin down by sex and adds up to the totals", async () => {
      const breakdown = await resolveBreakdown(viewer, { kind: "sex" });
      const stats = await activityStatistics(viewer, { ...range, groupId: fx.leaf.id, breakdown });
      const rows = stats.breakdown!.rows;
      expect(stats.breakdown!.label).toBe("Jenis kelamin");
      expect(rows.find((r) => r.key === "p:L")).toMatchObject({ expected: 3, hadir: 1, izin: 1, absent: 1 });
      expect(rows.find((r) => r.key === "p:P")).toMatchObject({ expected: 2, hadir: 2, izin: 0, absent: 0, percentHadir: 100 });
      const total = (key: "expected" | "hadir" | "izin") => stats.occurrences.reduce((s, o) => s + o[key], 0);
      for (const key of ["expected", "hadir", "izin"] as const) {
        expect(rows.reduce((s, r) => s + r[key], 0)).toBe(total(key));
      }
    });

    it("puts members without a value of a tag key in Tanpa nilai", async () => {
      const breakdown = await resolveBreakdown(viewer, { kind: "tag", tagId: tinggiId });
      const stats = await activityStatistics(viewer, { ...range, groupId: fx.leaf.id, breakdown });
      expect(stats.breakdown!.rows.map((r) => [r.label, r.expected, r.hadir])).toEqual([
        ["tinggi", 1, 1],
        ["Tanpa nilai", 4, 2],
      ]);
    });

    it("resolves a tag the viewer cannot see to no breakdown", async () => {
      expect(await resolveBreakdown(viewer, { kind: "tag", tagId: siblingTagId })).toBeNull();
      expect(await resolveBreakdown(viewer, { kind: "tag", tagId: 999999 })).toBeNull();
      expect(await resolveBreakdown(viewer, undefined)).toBeNull();
    });

    it("only counts members of the selected scope group", async () => {
      await add(fx.otherLeaf.id, "Di Luar", { sex: "P" });
      const breakdown = await resolveBreakdown(viewer, { kind: "sex" });
      const stats = await activityStatistics(viewer, { ...range, groupId: fx.leaf.id, breakdown });
      expect(stats.breakdown!.rows.find((r) => r.key === "p:P")!.expected).toBe(2);
    });

    it("breaks one activity's summary down the same way", async () => {
      const row = await db.activity.findUniqueOrThrow({ where: { id: activityId } });
      const breakdown = await resolveBreakdown(viewer, { kind: "sex" });
      const summary = await activityAttendanceSummary(activityId, toActivityTemplate(row), fx.leaf.path, {
        ...range, timeZone: "Asia/Jakarta", breakdown,
      });
      expect(summary.breakdown!.rows.find((r) => r.key === "p:L")).toMatchObject({ expected: 3, hadir: 1, izin: 1 });
      expect(summary.breakdown!.rows.reduce((s, r) => s + r.expected, 0)).toBe(summary.totalExpected);
      const none = await activityAttendanceSummary(activityId, toActivityTemplate(row), fx.leaf.path, { ...range, timeZone: "Asia/Jakarta" });
      expect(none.breakdown).toBeNull();
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
