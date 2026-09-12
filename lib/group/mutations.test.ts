import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session-user";
import { createGroup, deleteGroup, renameGroup } from "./mutations";

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

describe("lib/group/mutations", () => {
  let root: { id: number; path: string; organizationId: number };
  let branchA: { id: number; path: string };
  let branchB: { id: number; path: string };
  let leafA: { id: number; path: string };

  beforeAll(async () => {
    const actor = await db.user.create({
      data: { username: "group-mutations-actor", passwordHash: "x", name: "Actor" },
    });
    actorId = actor.id;

    const organization = await db.organization.create({ data: { name: "Group Mutations Test Org" } });
    for (const [depth, name] of ["Root", "Branch", "Leaf"].entries()) {
      await db.level.create({ data: { organizationId: organization.id, depth, name } });
    }
    const rootRow = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "" },
    });
    root = await db.group.update({ where: { id: rootRow.id }, data: { path: `${rootRow.id}/` } });

    const branchARow = await db.group.create({
      data: { organizationId: organization.id, parentId: root.id, depth: 1, name: "Branch A", path: "" },
    });
    branchA = await db.group.update({
      where: { id: branchARow.id },
      data: { path: `${root.path}${branchARow.id}/` },
    });

    const branchBRow = await db.group.create({
      data: { organizationId: organization.id, parentId: root.id, depth: 1, name: "Branch B", path: "" },
    });
    branchB = await db.group.update({
      where: { id: branchBRow.id },
      data: { path: `${root.path}${branchBRow.id}/` },
    });

    const leafARow = await db.group.create({
      data: { organizationId: organization.id, parentId: branchA.id, depth: 2, name: "Leaf A", path: "" },
    });
    leafA = await db.group.update({
      where: { id: leafARow.id },
      data: { path: `${branchA.path}${leafARow.id}/` },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("createGroup", () => {
    it("inserts the group and writes its materialized path in one call", async () => {
      const session = sessionAt("ADMIN", branchA.id, branchA.path);
      const created = await createGroup(session, { parentId: branchA.id, name: "Leaf New" });

      expect(created.depth).toBe(2); // branchA is depth 1
      expect(created.path).toBe(`${branchA.path}${created.id}/`);
    });

    it("writes a group.create audit entry", async () => {
      const session = sessionAt("ADMIN", branchA.id, branchA.path);
      const created = await createGroup(session, { parentId: branchA.id, name: "Leaf Audited" });

      const entry = await db.auditLog.findFirst({
        where: { action: "group.create", entityId: created.id },
      });
      expect(entry).toMatchObject({ actorId, entity: "Group", groupId: created.id });
    });

    it("rejects a duplicate name among live siblings", async () => {
      const session = sessionAt("ADMIN", branchA.id, branchA.path);
      await createGroup(session, { parentId: branchA.id, name: "Dup Sibling" });

      await expect(
        createGroup(session, { parentId: branchA.id, name: "Dup Sibling" }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("throws NotFoundError for a parent outside the caller's scope", async () => {
      const session = sessionAt("ADMIN", branchA.id, branchA.path);
      await expect(createGroup(session, { parentId: branchB.id, name: "Sneaky" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("throws ForbiddenError for a USER", async () => {
      const session = sessionAt("USER", branchA.id, branchA.path);
      await expect(
        createGroup(session, { parentId: branchA.id, name: "By User" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("rejects creating a child below the deepest configured level", async () => {
      const session = sessionAt("ADMIN", leafA.id, leafA.path);
      await expect(
        createGroup(session, { parentId: leafA.id, name: "Too Deep" }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("renameGroup", () => {
    it("updates the name and writes a group.update audit entry", async () => {
      const session = sessionAt("ADMIN", branchA.id, branchA.path);
      const created = await createGroup(session, { parentId: branchA.id, name: "Before Rename" });

      const renamed = await renameGroup(session, { groupId: created.id, name: "After Rename" });
      expect(renamed.name).toBe("After Rename");

      const entry = await db.auditLog.findFirst({
        where: { action: "group.update", entityId: created.id },
      });
      expect(entry).toMatchObject({
        before: { name: "Before Rename" },
        after: { name: "After Rename" },
      });
    });

    it("rejects renaming to a name already used by a live sibling", async () => {
      const session = sessionAt("ADMIN", branchA.id, branchA.path);
      await createGroup(session, { parentId: branchA.id, name: "Taken Name" });
      const other = await createGroup(session, { parentId: branchA.id, name: "Renaming Me" });

      await expect(renameGroup(session, { groupId: other.id, name: "Taken Name" })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it("throws NotFoundError for a group outside scope", async () => {
      const session = sessionAt("ADMIN", branchB.id, branchB.path);
      await expect(renameGroup(session, { groupId: leafA.id, name: "Nope" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("deleteGroup", () => {
    it("soft-deletes an empty group", async () => {
      const session = sessionAt("ADMIN", branchA.id, branchA.path);
      const created = await createGroup(session, { parentId: branchA.id, name: "To Delete" });

      const deleted = await deleteGroup(session, created.id);
      expect(deleted.deletedAt).not.toBeNull();

      const found = await db.group.findUnique({ where: { id: created.id } });
      expect(found).toBeNull();
    });

    it("rejects deleting a group that still has a child", async () => {
      const session = sessionAt("ADMIN", branchA.id, branchA.path);
      await expect(deleteGroup(session, branchA.id)).rejects.toBeInstanceOf(ValidationError);
    });

    it("rejects deleting a group that still has a member", async () => {
      const session = sessionAt("ADMIN", leafA.id, leafA.path);
      const creator = await db.user.create({
        data: { username: `deleter-${leafA.id}`, passwordHash: "x", name: "Creator" },
      });
      await db.member.create({
        data: {
          groupId: leafA.id,
          name: "Anggota",
          birthPlace: "Jakarta",
          birthDate: "2000-01-01",
          sex: "L",
          address: "-",
          phone: "0800000000",
          maritalStatus: "BELUM_MENIKAH",
          workStatus: "BEKERJA",
          joinedAt: "2024-01-01",
          createdById: creator.id,
        },
      });

      await expect(deleteGroup(session, leafA.id)).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
