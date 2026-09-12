import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { createMember, deleteMember, updateMember } from "./mutations";

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

const validInput = {
  name: "Anggota Uji",
  birthPlace: "Jakarta",
  birthDate: "2000-01-01",
  sex: "L" as const,
  address: "Jl. Uji No. 1",
  phone: "081200000000",
  maritalStatus: "BELUM_MENIKAH" as const,
  workStatus: "BEKERJA" as const,
  status: "AKTIF" as const,
  joinedAt: "2024-01-01",
};

describe("lib/member/mutations", () => {
  let root: { id: number; path: string };
  let branch: { id: number; path: string };
  let leaf: { id: number; path: string };
  let otherLeaf: { id: number; path: string };

  beforeAll(async () => {
    const actor = await db.user.create({
      data: { username: "member-mutations-actor", passwordHash: "x", name: "Actor" },
    });
    actorId = actor.id;

    const organization = await db.organization.create({ data: { name: "Member Mutations Test Org" } });
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

    const otherLeafRow = await db.group.create({
      data: { organizationId: organization.id, parentId: branch.id, depth: 2, name: "Other Leaf", path: "" },
    });
    otherLeaf = await db.group.update({
      where: { id: otherLeafRow.id },
      data: { path: `${branch.path}${otherLeafRow.id}/` },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("createMember", () => {
    it("creates a member in a leaf group", async () => {
      const session = sessionAt("USER", leaf.id, leaf.path);
      const created = await createMember(session, { ...validInput, groupId: leaf.id });

      expect(created.groupId).toBe(leaf.id);
      expect(created.createdById).toBe(actorId);
      expect(created.status).toBe("AKTIF");
    });

    it("writes a member.create audit entry with a full snapshot", async () => {
      const session = sessionAt("USER", leaf.id, leaf.path);
      const created = await createMember(session, { ...validInput, groupId: leaf.id, name: "Audited" });

      const entry = await db.auditLog.findFirst({
        where: { action: "member.create", entityId: created.id },
      });
      expect(entry).toMatchObject({ actorId, entity: "Member", groupId: leaf.id });
      expect(entry?.after).toMatchObject({ name: "Audited" });
    });

    it("rejects creating a member in a non-leaf group", async () => {
      const session = sessionAt("USER", branch.id, branch.path);
      await expect(
        createMember(session, { ...validInput, groupId: branch.id }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("throws NotFoundError for a group outside the caller's scope", async () => {
      const session = sessionAt("USER", otherLeaf.id, otherLeaf.path);
      await expect(
        createMember(session, { ...validInput, groupId: leaf.id }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("updateMember", () => {
    it("updates member fields and writes a before/after audit entry", async () => {
      const session = sessionAt("USER", leaf.id, leaf.path);
      const created = await createMember(session, { ...validInput, groupId: leaf.id, name: "Before Update" });

      const updated = await updateMember(session, {
        ...validInput,
        memberId: created.id,
        name: "After Update",
      });
      expect(updated.name).toBe("After Update");

      const entry = await db.auditLog.findFirst({
        where: { action: "member.update", entityId: created.id },
      });
      expect(entry?.before).toMatchObject({ name: "Before Update" });
      expect(entry?.after).toMatchObject({ name: "After Update" });
    });

    it("throws NotFoundError for a member outside the caller's scope", async () => {
      const owner = sessionAt("USER", leaf.id, leaf.path);
      const created = await createMember(owner, { ...validInput, groupId: leaf.id });

      const outsider = sessionAt("USER", otherLeaf.id, otherLeaf.path);
      await expect(
        updateMember(outsider, { ...validInput, memberId: created.id }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("deleteMember", () => {
    it("soft-deletes a member", async () => {
      const session = sessionAt("USER", leaf.id, leaf.path);
      const created = await createMember(session, { ...validInput, groupId: leaf.id });

      const deleted = await deleteMember(session, created.id);
      expect(deleted.deletedAt).not.toBeNull();

      const found = await db.member.findUnique({ where: { id: created.id } });
      expect(found).toBeNull();
    });

    it("throws NotFoundError for a member outside the caller's scope", async () => {
      const owner = sessionAt("USER", leaf.id, leaf.path);
      const created = await createMember(owner, { ...validInput, groupId: leaf.id });

      const outsider = sessionAt("USER", otherLeaf.id, otherLeaf.path);
      await expect(deleteMember(outsider, created.id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
