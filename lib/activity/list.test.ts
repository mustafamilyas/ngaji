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
      groupIds: [leaf.id],
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

  describe("multi-group union", () => {
    let siblingLeaf: { id: number; path: string };
    let foreignLeaf: { id: number; path: string };

    beforeAll(async () => {
      const branchRow = await db.group.findUniqueOrThrow({ where: { id: branch.id } });

      const siblingLeafRow = await db.group.create({
        data: {
          organizationId: branchRow.organizationId,
          parentId: branch.id,
          depth: 2,
          name: "Sibling Leaf",
          path: "",
        },
      });
      siblingLeaf = await db.group.update({
        where: { id: siblingLeafRow.id },
        data: { path: `${branch.path}${siblingLeafRow.id}/` },
      });

      const foreignOrg = await db.organization.create({ data: { name: "Foreign Org" } });
      for (const [depth, name] of ["Root", "Leaf"].entries()) {
        await db.level.create({ data: { organizationId: foreignOrg.id, depth, name } });
      }
      const foreignRootRow = await db.group.create({
        data: { organizationId: foreignOrg.id, depth: 0, name: "Foreign Root", path: "" },
      });
      const foreignRoot = await db.group.update({
        where: { id: foreignRootRow.id },
        data: { path: `${foreignRootRow.id}/` },
      });
      const foreignLeafRow = await db.group.create({
        data: { organizationId: foreignOrg.id, parentId: foreignRoot.id, depth: 1, name: "Foreign Leaf", path: "" },
      });
      foreignLeaf = await db.group.update({
        where: { id: foreignLeafRow.id },
        data: { path: `${foreignRoot.path}${foreignLeafRow.id}/` },
      });
    });

    it("unions two unrelated groups' results with no cross-visibility", async () => {
      const leafAdmin = sessionAt("ADMIN", leaf.id, leaf.path);
      await createActivity(leafAdmin, {
        groupId: leaf.id,
        name: "Kelompok A",
        location: "A",
        startTime: "19:00",
        durationMinutes: 60,
        freq: "ONCE",
        interval: 1,
        weekdays: [],
        startsOn: "2026-08-01",
        endsOn: "2026-08-01",
      });
      const siblingAdmin = sessionAt("ADMIN", siblingLeaf.id, siblingLeaf.path);
      await createActivity(siblingAdmin, {
        groupId: siblingLeaf.id,
        name: "Kelompok B",
        location: "B",
        startTime: "19:00",
        durationMinutes: 60,
        freq: "ONCE",
        interval: 1,
        weekdays: [],
        startsOn: "2026-08-01",
        endsOn: "2026-08-01",
      });

      const branchAdmin = sessionAt("ADMIN", branch.id, branch.path);
      const { entries } = await listActivityOccurrences(branchAdmin, {
        from: "2026-08-01",
        to: "2026-08-01",
        groupIds: [leaf.id, siblingLeaf.id],
      });

      expect(entries.map((e) => e.activityName).sort()).toEqual(["Kelompok A", "Kelompok B"]);
    });

    it("shows an activity owned by a shared ancestor exactly once", async () => {
      const branchAdmin = sessionAt("ADMIN", branch.id, branch.path);
      await createActivity(branchAdmin, {
        groupId: branch.id,
        name: "Kajian Daerah Bersama",
        location: "Aula Daerah",
        startTime: "19:00",
        durationMinutes: 60,
        freq: "ONCE",
        interval: 1,
        weekdays: [],
        startsOn: "2026-08-03",
        endsOn: "2026-08-03",
      });

      const { entries } = await listActivityOccurrences(branchAdmin, {
        from: "2026-08-03",
        to: "2026-08-03",
        groupIds: [leaf.id, siblingLeaf.id],
      });

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ activityName: "Kajian Daerah Bersama", inherited: true });
    });

    it("drops an out-of-scope id and returns only the valid id's results", async () => {
      const leafAdmin = sessionAt("ADMIN", leaf.id, leaf.path);
      await createActivity(leafAdmin, {
        groupId: leaf.id,
        name: "Kelompok Saja",
        location: "C",
        startTime: "19:00",
        durationMinutes: 60,
        freq: "ONCE",
        interval: 1,
        weekdays: [],
        startsOn: "2026-08-04",
        endsOn: "2026-08-04",
      });

      const { entries, groups } = await listActivityOccurrences(leafAdmin, {
        from: "2026-08-04",
        to: "2026-08-04",
        groupIds: [leaf.id, foreignLeaf.id],
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].activityName).toBe("Kelompok Saja");
      expect(groups.map((g) => g.id)).toEqual([leaf.id]);
    });
  });
});
