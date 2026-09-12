import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/session-user";
import { createActivity } from "@/lib/activity/mutations";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { overrideOccurrence } from "./occurrence-mutations";

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

describe("lib/activity/occurrence-mutations overrideOccurrence", () => {
  let leaf: { id: number; path: string };
  let session: SessionUser;

  beforeAll(async () => {
    const actor = await db.user.create({
      data: { username: "occurrence-mutations-actor", passwordHash: "x", name: "Actor" },
    });
    actorId = actor.id;

    const organization = await db.organization.create({ data: { name: "Occurrence Mutations Test Org" } });
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

  it("cancels a valid rule date", async () => {
    const { activity } = await createActivity(session, {
      groupId: leaf.id,
      name: "Weekly",
      location: "Masjid",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [1],
      startsOn: "2026-01-05",
    });

    const updated = await overrideOccurrence(session, {
      activityId: activity.id,
      date: "2026-09-14",
      status: "CANCELLED",
    });

    expect(updated.status).toBe("CANCELLED");
    expect(updated.date).toBe("2026-09-14");
  });

  it("moves an occurrence once, keeping the rule date as the key", async () => {
    const { activity } = await createActivity(session, {
      groupId: leaf.id,
      name: "Weekly Move",
      location: "Masjid",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [1],
      startsOn: "2026-01-05",
    });

    const moved = await overrideOccurrence(session, {
      activityId: activity.id,
      date: "2026-09-14",
      status: "SCHEDULED",
      overrideDate: "2026-09-16",
      overrideStartTime: "20:00",
    });

    expect(moved.date).toBe("2026-09-14");
    expect(moved.overrideDate).toBe("2026-09-16");
    expect(moved.overrideStartTime).toBe("20:00");
  });

  it("rejects moving onto a date that is already an occurrence of the same activity", async () => {
    const { activity } = await createActivity(session, {
      groupId: leaf.id,
      name: "Weekly Conflict Move",
      location: "Masjid",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [1],
      startsOn: "2026-01-05",
    });

    // Both 2026-09-14 and 2026-09-21 are rule-generated Mondays.
    await expect(
      overrideOccurrence(session, {
        activityId: activity.id,
        date: "2026-09-14",
        status: "SCHEDULED",
        overrideDate: "2026-09-21",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("responds 404 for a date the rule does not generate and that has no attendance", async () => {
    const { activity } = await createActivity(session, {
      groupId: leaf.id,
      name: "Weekly Invalid Date",
      location: "Masjid",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [1],
      startsOn: "2026-01-05",
    });

    await expect(
      overrideOccurrence(session, {
        activityId: activity.id,
        // 2026-09-15 is a Tuesday; the rule only generates Mondays.
        date: "2026-09-15",
        status: "CANCELLED",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
