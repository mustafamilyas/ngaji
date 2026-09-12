import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import {
  resolveActivity,
  resolveGroup,
  resolveMember,
  resolveOccurrence,
  resolveUser,
} from "./resolve";
import type { SessionUser } from "./auth/session-user";

function sessionAt(groupId: number, groupPath: string): SessionUser {
  return {
    id: "1",
    username: "tester",
    name: "Tester",
    role: "ADMIN",
    groupId,
    groupPath,
    mustChangePassword: false,
  };
}

describe("lib/resolve", () => {
  let root: { id: number; path: string };
  let branchA: { id: number; path: string }; // under root
  let leafA: { id: number; path: string }; // under branchA
  let branchB: { id: number; path: string }; // sibling of branchA, under root
  let owner: { id: number };

  beforeAll(async () => {
    const organization = await db.organization.create({ data: { name: "Resolve Test Org" } });
    root = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "" },
    });
    root = await db.group.update({ where: { id: root.id }, data: { path: `${root.id}/` } });

    const branch = await db.group.create({
      data: { organizationId: organization.id, parentId: root.id, depth: 1, name: "Branch A", path: "" },
    });
    branchA = await db.group.update({
      where: { id: branch.id },
      data: { path: `${root.path}${branch.id}/` },
    });

    const leaf = await db.group.create({
      data: { organizationId: organization.id, parentId: branchA.id, depth: 2, name: "Leaf A", path: "" },
    });
    leafA = await db.group.update({ where: { id: leaf.id }, data: { path: `${branchA.path}${leaf.id}/` } });

    const branch2 = await db.group.create({
      data: { organizationId: organization.id, parentId: root.id, depth: 1, name: "Branch B", path: "" },
    });
    branchB = await db.group.update({
      where: { id: branch2.id },
      data: { path: `${root.path}${branch2.id}/` },
    });

    owner = await db.user.create({
      data: { username: `resolve-owner-${root.id}`, passwordHash: "x", name: "Owner" },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("resolveGroup", () => {
    it("resolves a group within scope", async () => {
      const session = sessionAt(branchA.id, branchA.path);
      const group = await resolveGroup(session, leafA.id);
      expect(group.id).toBe(leafA.id);
    });

    it("throws NotFoundError for a group above the scope (ancestor)", async () => {
      const session = sessionAt(branchA.id, branchA.path);
      await expect(resolveGroup(session, root.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for a sibling-branch group", async () => {
      const session = sessionAt(branchA.id, branchA.path);
      await expect(resolveGroup(session, branchB.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for a non-existent id", async () => {
      const session = sessionAt(root.id, root.path);
      await expect(resolveGroup(session, 999_999)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for a soft-deleted group even within scope", async () => {
      const deleted = await db.group.create({
        data: {
          organizationId: (await db.group.findUniqueOrThrow({ where: { id: root.id } })).organizationId,
          parentId: root.id,
          depth: 1,
          name: "Deleted Branch",
          path: `${root.path}999999/`,
          deletedAt: new Date(),
        },
      });
      const session = sessionAt(root.id, root.path);
      await expect(resolveGroup(session, deleted.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("resolveMember", () => {
    it("resolves a member in scope and rejects one outside scope", async () => {
      const memberInA = await db.member.create({
        data: {
          groupId: leafA.id,
          name: "Anggota A",
          birthPlace: "Jakarta",
          birthDate: "2000-01-01",
          sex: "L",
          address: "-",
          phone: "0800000000",
          maritalStatus: "BELUM_MENIKAH",
          workStatus: "BEKERJA",
          joinedAt: "2024-01-01",
          createdById: owner.id,
        },
      });

      const inScope = sessionAt(branchA.id, branchA.path);
      const resolved = await resolveMember(inScope, memberInA.id);
      expect(resolved.id).toBe(memberInA.id);

      const outOfScope = sessionAt(branchB.id, branchB.path);
      await expect(resolveMember(outOfScope, memberInA.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("resolveActivity", () => {
    it("resolves an activity owned by the session's own group", async () => {
      const activity = await db.activity.create({
        data: {
          groupId: branchA.id,
          name: "Kajian",
          location: "Aula",
          startTime: "19:00",
          durationMinutes: 60,
          freq: "WEEKLY",
          weekdays: [0],
          startsOn: "2026-01-01",
          createdById: owner.id,
        },
      });
      const session = sessionAt(branchA.id, branchA.path);
      const resolved = await resolveActivity(session, activity.id);
      expect(resolved.id).toBe(activity.id);
    });

    it("resolves an activity owned by an ancestor group (inherited, visible)", async () => {
      const activity = await db.activity.create({
        data: {
          groupId: root.id,
          name: "Kajian Pusat",
          location: "Aula Pusat",
          startTime: "19:00",
          durationMinutes: 60,
          freq: "WEEKLY",
          weekdays: [0],
          startsOn: "2026-01-01",
          createdById: owner.id,
        },
      });
      const session = sessionAt(leafA.id, leafA.path);
      const resolved = await resolveActivity(session, activity.id);
      expect(resolved.id).toBe(activity.id);
    });

    it("resolves an activity owned by a descendant group (visible to an ancestor session)", async () => {
      const activity = await db.activity.create({
        data: {
          groupId: leafA.id,
          name: "Kajian Leaf",
          location: "Ruang Leaf",
          startTime: "19:00",
          durationMinutes: 60,
          freq: "WEEKLY",
          weekdays: [0],
          startsOn: "2026-01-01",
          createdById: owner.id,
        },
      });
      const session = sessionAt(branchA.id, branchA.path);
      const resolved = await resolveActivity(session, activity.id);
      expect(resolved.id).toBe(activity.id);
    });

    it("throws NotFoundError for an activity on a sibling branch", async () => {
      const activity = await db.activity.create({
        data: {
          groupId: branchB.id,
          name: "Kajian B",
          location: "Aula B",
          startTime: "19:00",
          durationMinutes: 60,
          freq: "WEEKLY",
          weekdays: [0],
          startsOn: "2026-01-01",
          createdById: owner.id,
        },
      });
      const session = sessionAt(branchA.id, branchA.path);
      await expect(resolveActivity(session, activity.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("resolveOccurrence", () => {
    it("resolves an occurrence whose activity is visible, and rejects one that isn't", async () => {
      const activity = await db.activity.create({
        data: {
          groupId: branchA.id,
          name: "Kajian Occ",
          location: "Aula",
          startTime: "19:00",
          durationMinutes: 60,
          freq: "WEEKLY",
          weekdays: [0],
          startsOn: "2026-01-04",
          createdById: owner.id,
        },
      });
      const occurrence = await db.activityOccurrence.create({
        data: { activityId: activity.id, date: "2026-01-04" },
      });

      const inScope = sessionAt(branchA.id, branchA.path);
      const resolved = await resolveOccurrence(inScope, occurrence.id);
      expect(resolved.id).toBe(occurrence.id);

      const outOfScope = sessionAt(branchB.id, branchB.path);
      await expect(resolveOccurrence(outOfScope, occurrence.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for a non-existent occurrence id", async () => {
      const session = sessionAt(root.id, root.path);
      await expect(resolveOccurrence(session, 999_999)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("resolveUser", () => {
    it("resolves a user whose group is in scope and rejects one outside scope", async () => {
      const targetUser = await db.user.create({
        data: { username: `target-${leafA.id}`, passwordHash: "x", name: "Target" },
      });
      await db.userGroupRole.create({ data: { userId: targetUser.id, groupId: leafA.id, role: "USER" } });

      const inScope = sessionAt(branchA.id, branchA.path);
      const resolved = await resolveUser(inScope, targetUser.id);
      expect(resolved.id).toBe(targetUser.id);

      const outOfScope = sessionAt(branchB.id, branchB.path);
      await expect(resolveUser(outOfScope, targetUser.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError for a user with no role assignment", async () => {
      const roleless = await db.user.create({
        data: { username: `roleless-${root.id}`, passwordHash: "x", name: "Roleless" },
      });
      const session = sessionAt(root.id, root.path);
      await expect(resolveUser(session, roleless.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
