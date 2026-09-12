import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import {
  createActivity,
  deleteActivity,
  endActivity,
  splitActivity,
  updateActivity,
} from "./mutations";

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

function baseActivity(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Kajian Rutin",
    location: "Masjid",
    startTime: "19:00",
    durationMinutes: 60,
    freq: "DAILY" as const,
    interval: 1,
    weekdays: [],
    startsOn: "2026-01-05",
    ...overrides,
  };
}

describe("lib/activity/mutations", () => {
  let root: { id: number; path: string };
  let branch: { id: number; path: string };
  let leaf: { id: number; path: string };

  beforeAll(async () => {
    const actor = await db.user.create({
      data: { username: "activity-mutations-actor", passwordHash: "x", name: "Actor" },
    });
    actorId = actor.id;

    const organization = await db.organization.create({ data: { name: "Activity Mutations Test Org" } });
    for (const [depth, name] of ["Root", "Branch", "Leaf"].entries()) {
      await db.level.create({ data: { organizationId: organization.id, depth, name } });
    }
    const rootRow = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "" },
    });
    root = await db.group.update({ where: { id: rootRow.id }, data: { path: `${rootRow.id}/` } });

    const branchRow = await db.group.create({
      data: { organizationId: organization.id, parentId: root.id, depth: 1, name: "Branch", path: "" },
    });
    branch = await db.group.update({
      where: { id: branchRow.id },
      data: { path: `${root.path}${branchRow.id}/` },
    });

    const leafRow = await db.group.create({
      data: { organizationId: organization.id, parentId: branch.id, depth: 2, name: "Leaf", path: "" },
    });
    leaf = await db.group.update({
      where: { id: leafRow.id },
      data: { path: `${branch.path}${leafRow.id}/` },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("createActivity", () => {
    it("creates an activity owned by the caller's own group and writes an audit entry", async () => {
      const session = sessionAt("ADMIN", leaf.id, leaf.path);
      const { activity } = await createActivity(session, { ...baseActivity(), groupId: leaf.id });

      expect(activity.groupId).toBe(leaf.id);
      expect(activity.createdById).toBe(actorId);

      const entry = await db.auditLog.findFirst({ where: { action: "activity.create", entityId: activity.id } });
      expect(entry).toMatchObject({ actorId, entity: "Activity", groupId: leaf.id });
    });

    it("throws ForbiddenError for a USER", async () => {
      const session = sessionAt("USER", leaf.id, leaf.path);
      await expect(createActivity(session, { ...baseActivity(), groupId: leaf.id })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it("throws ForbiddenError when groupId is not the caller's own group", async () => {
      const session = sessionAt("ADMIN", branch.id, branch.path);
      await expect(createActivity(session, { ...baseActivity(), groupId: leaf.id })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it("still saves when the new activity conflicts with an existing one, but reports the conflict", async () => {
      const session = sessionAt("ADMIN", leaf.id, leaf.path);
      await createActivity(session, {
        ...baseActivity({ name: "Existing" }),
        groupId: leaf.id,
        startTime: "19:00",
        durationMinutes: 60,
      });

      const { activity, hasConflict } = await createActivity(session, {
        ...baseActivity({ name: "Overlapping" }),
        groupId: leaf.id,
        startTime: "19:30",
        durationMinutes: 60,
      });

      expect(hasConflict).toBe(true);
      const found = await db.activity.findUnique({ where: { id: activity.id } });
      expect(found).not.toBeNull();
    });
  });

  describe("updateActivity", () => {
    it("throws ForbiddenError for a root OWNER editing a descendant's activity", async () => {
      const owner = sessionAt("ADMIN", leaf.id, leaf.path);
      const { activity } = await createActivity(owner, { ...baseActivity(), groupId: leaf.id });

      const rootOwner = sessionAt("OWNER", root.id, root.path);
      await expect(
        updateActivity(rootOwner, activity.id, baseActivity({ name: "Renamed" })),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("updates the template and writes a before/after audit entry", async () => {
      const session = sessionAt("ADMIN", leaf.id, leaf.path);
      const { activity } = await createActivity(session, { ...baseActivity({ name: "Old Name" }), groupId: leaf.id });

      const { activity: updated } = await updateActivity(session, activity.id, baseActivity({ name: "New Name" }));
      expect(updated.name).toBe("New Name");

      const entry = await db.auditLog.findFirst({ where: { action: "activity.update", entityId: activity.id } });
      expect(entry?.before).toMatchObject({ name: "Old Name" });
      expect(entry?.after).toMatchObject({ name: "New Name" });
    });
  });

  describe("endActivity", () => {
    it("sets endsOn = X-1 when X is after startsOn", async () => {
      const session = sessionAt("ADMIN", leaf.id, leaf.path);
      const { activity } = await createActivity(session, { ...baseActivity({ startsOn: "2026-02-01" }), groupId: leaf.id });

      const ended = await endActivity(session, { activityId: activity.id, fromDate: "2026-02-10" });
      expect(ended.endsOn).toBe("2026-02-09");
      expect(ended.deletedAt).toBeNull();
    });

    it("soft-deletes when X <= startsOn", async () => {
      const session = sessionAt("ADMIN", leaf.id, leaf.path);
      const { activity } = await createActivity(session, { ...baseActivity({ startsOn: "2026-03-01" }), groupId: leaf.id });

      const ended = await endActivity(session, { activityId: activity.id, fromDate: "2026-03-01" });
      expect(ended.deletedAt).not.toBeNull();
    });
  });

  describe("deleteActivity", () => {
    it("soft-deletes the activity", async () => {
      const session = sessionAt("ADMIN", leaf.id, leaf.path);
      const { activity } = await createActivity(session, { ...baseActivity(), groupId: leaf.id });

      const deleted = await deleteActivity(session, activity.id);
      expect(deleted.deletedAt).not.toBeNull();

      const found = await db.activity.findUnique({ where: { id: activity.id } });
      expect(found).toBeNull();
    });
  });

  describe("splitActivity", () => {
    it("rejects for a ONCE activity", async () => {
      const session = sessionAt("ADMIN", leaf.id, leaf.path);
      const { activity } = await createActivity(session, {
        ...baseActivity({ freq: "ONCE", interval: 1, startsOn: "2026-04-01", endsOn: "2026-04-01" }),
        groupId: leaf.id,
      });

      await expect(
        splitActivity(session, { activityId: activity.id, ...baseActivity({ startsOn: "2026-04-01" }) }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("edits in place when X <= startsOn", async () => {
      const session = sessionAt("ADMIN", leaf.id, leaf.path);
      const { activity } = await createActivity(session, { ...baseActivity({ startsOn: "2026-05-10" }), groupId: leaf.id });

      const result = await splitActivity(session, {
        activityId: activity.id,
        ...baseActivity({ name: "In Place Edit", startsOn: "2026-05-10" }),
      });

      expect(result.splitCreated).toBe(false);
      expect(result.activity.id).toBe(activity.id);
      expect(result.activity.name).toBe("In Place Edit");
    });

    it("splits from the middle: ends the original, creates a continuation, and re-parents occurrences with their attendance", async () => {
      const session = sessionAt("ADMIN", leaf.id, leaf.path);
      const { activity: original } = await createActivity(session, {
        ...baseActivity({ freq: "WEEKLY", weekdays: [1], interval: 1, startsOn: "2026-01-05" }),
        groupId: leaf.id,
      });

      // A Monday on/after the split point, with attendance attached.
      const occurrence = await db.activityOccurrence.create({
        data: { activityId: original.id, date: "2026-09-14" },
      });
      const member = await db.member.create({
        data: {
          groupId: leaf.id,
          name: "Anggota Split",
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
      const attendance = await db.attendance.create({
        data: { occurrenceId: occurrence.id, memberId: member.id, status: "HADIR", recordedById: actorId },
      });

      const result = await splitActivity(session, {
        activityId: original.id,
        ...baseActivity({
          name: "Continued",
          freq: "WEEKLY",
          weekdays: [4],
          interval: 1,
          startsOn: "2026-09-14",
        }),
      });

      expect(result.splitCreated).toBe(true);
      expect(result.activity.id).not.toBe(original.id);
      expect(result.activity.continuesFromId).toBe(original.id);

      const updatedOriginal = await db.activity.findUnique({ where: { id: original.id } });
      expect(updatedOriginal?.endsOn).toBe("2026-09-13");

      const movedOccurrence = await db.activityOccurrence.findUnique({ where: { id: occurrence.id } });
      expect(movedOccurrence?.activityId).toBe(result.activity.id);

      const stillAttended = await db.attendance.findUnique({ where: { id: attendance.id } });
      expect(stillAttended?.occurrenceId).toBe(occurrence.id);

      const entry = await db.auditLog.findFirst({ where: { action: "activity.split", entityId: original.id } });
      expect(entry?.after).toMatchObject({
        fromActivityId: original.id,
        toActivityId: result.activity.id,
        fromDate: "2026-09-14",
      });
    });
  });
});
