import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createActivity } from "@/lib/activity/mutations";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { listActivityOccurrences } from "./list";

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

describe("lib/activity/list listActivityOccurrences", () => {
  let root: { id: number; path: string };
  let branch: { id: number; path: string };
  let leaf: { id: number; path: string };

  beforeAll(async () => {
    const actor = await db.user.create({
      data: { username: "activity-list-actor", passwordHash: "x", name: "Actor" },
    });
    actorId = actor.id;

    const organization = await db.organization.create({ data: { name: "Activity List Test Org" } });
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
    leaf = await db.group.update({ where: { id: leafRow.id }, data: { path: `${branch.path}${leafRow.id}/` } });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("marks an activity owned by an ancestor as inherited and not editable from the descendant", async () => {
    const branchAdmin = sessionAt("ADMIN", branch.id, branch.path);
    await createActivity(branchAdmin, {
      groupId: branch.id,
      name: "Kajian Daerah",
      location: "Masjid Daerah",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "ONCE",
      interval: 1,
      weekdays: [],
      startsOn: "2026-06-01",
      endsOn: "2026-06-01",
    });

    const leafAdmin = sessionAt("ADMIN", leaf.id, leaf.path);
    const { entries } = await listActivityOccurrences(leafAdmin, { from: "2026-06-01", to: "2026-06-01" });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ inherited: true, canEdit: false, canRecord: true });
  });

  it("does not let a root OWNER record attendance for a descendant's activity", async () => {
    const leafAdmin = sessionAt("ADMIN", leaf.id, leaf.path);
    await createActivity(leafAdmin, {
      groupId: leaf.id,
      name: "Kajian Kelompok",
      location: "Rumah",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "ONCE",
      interval: 1,
      weekdays: [],
      startsOn: "2026-06-05",
      endsOn: "2026-06-05",
    });

    const rootOwner = sessionAt("OWNER", root.id, root.path);
    const { entries } = await listActivityOccurrences(rootOwner, {
      from: "2026-06-05",
      to: "2026-06-05",
      groupId: leaf.id,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ canEdit: false, canRecord: false });
  });

  it("flags overlapping occurrences from related groups as conflicting", async () => {
    const branchAdmin = sessionAt("ADMIN", branch.id, branch.path);
    await createActivity(branchAdmin, {
      groupId: branch.id,
      name: "Daerah 20:00",
      location: "A",
      startTime: "20:00",
      durationMinutes: 90,
      freq: "ONCE",
      interval: 1,
      weekdays: [],
      startsOn: "2026-07-01",
      endsOn: "2026-07-01",
    });
    const leafAdmin = sessionAt("ADMIN", leaf.id, leaf.path);
    await createActivity(leafAdmin, {
      groupId: leaf.id,
      name: "Kelompok 20:30",
      location: "B",
      startTime: "20:30",
      durationMinutes: 30,
      freq: "ONCE",
      interval: 1,
      weekdays: [],
      startsOn: "2026-07-01",
      endsOn: "2026-07-01",
    });

    const { entries } = await listActivityOccurrences(leafAdmin, { from: "2026-07-01", to: "2026-07-01" });
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.hasConflict)).toBe(true);
  });
});
