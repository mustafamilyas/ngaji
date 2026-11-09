import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { MAX_IMPORT_ROWS } from "@/lib/constants";
import { generateMemberCode } from "./code";
import { createMember, deleteMember, importMembers, updateMember } from "./mutations";

// Real generator by default; a test forces a duplicate with `mockReturnValueOnce`.
vi.mock("./code", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./code")>();
  return { ...actual, generateMemberCode: vi.fn(actual.generateMemberCode) };
});

const CODE = /^MMT-[0-9A-HJKMNP-TV-Z]{6}$/;

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

    const organization = await db.organization.create({
      data: { name: "Member Mutations Test Org", memberCodePrefix: "MMT" },
    });
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

    it("assigns a code with the organization prefix", async () => {
      const session = sessionAt("USER", leaf.id, leaf.path);
      const created = await createMember(session, { ...validInput, groupId: leaf.id });
      expect(created.code).toMatch(CODE);
    });

    it("generates a new code when the first one is already taken", async () => {
      const session = sessionAt("USER", leaf.id, leaf.path);
      const first = await createMember(session, { ...validInput, groupId: leaf.id });
      vi.mocked(generateMemberCode).mockReturnValueOnce(first.code!);

      const second = await createMember(session, { ...validInput, groupId: leaf.id });
      expect(second.code).toMatch(CODE);
      expect(second.code).not.toBe(first.code);
    });

    it("never reuses the code of a soft-deleted member", async () => {
      const session = sessionAt("USER", leaf.id, leaf.path);
      const deleted = await createMember(session, { ...validInput, groupId: leaf.id });
      await deleteMember(session, deleted.id);
      vi.mocked(generateMemberCode).mockReturnValueOnce(deleted.code!);

      const created = await createMember(session, { ...validInput, groupId: leaf.id });
      expect(created.code).not.toBe(deleted.code);
    });

    it("ignores a code sent by the client", async () => {
      const session = sessionAt("USER", leaf.id, leaf.path);
      const input = { ...validInput, groupId: leaf.id, code: "MMT-000000" } as typeof validInput & { groupId: number };
      const created = await createMember(session, input);
      expect(created.code).toMatch(CODE);
      expect(created.code).not.toBe("MMT-000000");
    });

    it("fails and creates nothing when the organization has no code prefix", async () => {
      const organization = await db.organization.create({ data: { name: "Member Mutations No Prefix Org" } });
      await db.level.create({ data: { organizationId: organization.id, depth: 0, name: "Only" } });
      const row = await db.group.create({ data: { organizationId: organization.id, depth: 0, name: "Only", path: "" } });
      const group = await db.group.update({ where: { id: row.id }, data: { path: `${row.id}/` } });

      const session = sessionAt("USER", group.id, group.path);
      await expect(createMember(session, { ...validInput, groupId: group.id })).rejects.toThrow(/prefix/);
      expect(await db.member.count({ where: { groupId: group.id } })).toBe(0);
    });

    it("writes a member.create audit entry with a full snapshot", async () => {
      const session = sessionAt("USER", leaf.id, leaf.path);
      const created = await createMember(session, { ...validInput, groupId: leaf.id, name: "Audited" });

      const entry = await db.auditLog.findFirst({
        where: { action: "member.create", entityId: created.id },
      });
      expect(entry).toMatchObject({ actorId, entity: "Member", groupId: leaf.id });
      expect(entry?.after).toMatchObject({ name: "Audited", code: created.code });
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

    it("keeps the code, even when the client sends another one", async () => {
      const session = sessionAt("USER", leaf.id, leaf.path);
      const created = await createMember(session, { ...validInput, groupId: leaf.id });

      const input = { ...validInput, memberId: created.id, name: "Renamed", code: "MMT-000000" };
      const updated = await updateMember(session, input as typeof input & { memberId: number });
      expect(updated.code).toBe(created.code);
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

  describe("importMembers", () => {
    const row = (name: string, groupId: number) => ({ ...validInput, name, groupId });

    const importAudits = async () =>
      (await db.auditLog.findMany({ where: { actorId, action: "member.create" } })).filter(
        (entry) => (entry.meta as { importId?: string } | null)?.importId,
      );

    it("creates every row in the group it names", async () => {
      const session = sessionAt("ADMIN", branch.id, branch.path);
      const result = await importMembers(session, [
        row("Imptest Impor Satu", leaf.id),
        row("Imptest Impor Dua", otherLeaf.id),
        row("Imptest Impor Tiga", leaf.id),
      ]);

      expect(result.created).toBe(3);
      const members = await db.member.findMany({ where: { name: { startsWith: "Imptest Impor " } }, orderBy: { name: "asc" } });
      expect(members.map((m) => [m.name, m.groupId])).toEqual([
        ["Imptest Impor Dua", otherLeaf.id],
        ["Imptest Impor Satu", leaf.id],
        ["Imptest Impor Tiga", leaf.id],
      ]);
    });

    it("lets a USER import into their own leaf group", async () => {
      const session = sessionAt("USER", leaf.id, leaf.path);
      const result = await importMembers(session, [row("Imptest Impor User", leaf.id)]);
      expect(result.created).toBe(1);
    });

    it("writes one member.create audit entry per member, all sharing the returned importId", async () => {
      const session = sessionAt("ADMIN", branch.id, branch.path);
      const { importId } = await importMembers(session, [row("Imptest Audit Satu", leaf.id), row("Imptest Audit Dua", leaf.id)]);

      const entries = (await importAudits()).filter((entry) => (entry.meta as { importId: string }).importId === importId);
      expect(entries).toHaveLength(2);
      expect(entries.every((entry) => entry.entity === "Member" && entry.after !== null)).toBe(true);
      const created = await db.member.findMany({ where: { name: { startsWith: "Imptest Audit " } } });
      expect(entries.map((entry) => entry.entityId).sort()).toEqual(created.map((m) => m.id).sort());
    });

    it("leaves no member and no audit entry when a later row fails", async () => {
      const session = sessionAt("ADMIN", branch.id, branch.path);
      const membersBefore = await db.member.count();
      const auditsBefore = (await importAudits()).length;
      const broken = { ...row("Imptest Rollback Tiga", leaf.id), birthPlace: undefined } as unknown as ReturnType<typeof row>;

      await expect(
        importMembers(session, [row("Imptest Rollback Satu", leaf.id), row("Imptest Rollback Dua", leaf.id), broken]),
      ).rejects.toThrow();

      expect(await db.member.count()).toBe(membersBefore);
      expect((await importAudits()).length).toBe(auditsBefore);
    });

    it("throws NotFoundError and creates nothing when any row targets a group outside scope", async () => {
      const session = sessionAt("USER", leaf.id, leaf.path);
      await expect(
        importMembers(session, [row("Imptest Luar Satu", leaf.id), row("Imptest Luar Dua", otherLeaf.id)]),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(await db.member.count({ where: { name: { startsWith: "Imptest Luar " } } })).toBe(0);
    });

    it("rejects a non-leaf group and creates nothing", async () => {
      const session = sessionAt("ADMIN", branch.id, branch.path);
      await expect(
        importMembers(session, [row("Imptest Cabang Satu", leaf.id), row("Imptest Cabang Dua", branch.id)]),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(await db.member.count({ where: { name: { startsWith: "Imptest Cabang " } } })).toBe(0);
    });

    it("rejects an empty list and a list over the row limit", async () => {
      const session = sessionAt("ADMIN", branch.id, branch.path);
      await expect(importMembers(session, [])).rejects.toBeInstanceOf(ValidationError);
      const tooMany = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => row(`Imptest Banyak ${i}`, leaf.id));
      await expect(importMembers(session, tooMany)).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
