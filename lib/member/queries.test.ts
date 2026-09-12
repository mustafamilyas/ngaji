import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { listMembers } from "./queries";

let actorId: number;

function sessionAt(groupId: number, groupPath: string): SessionUser {
  return {
    id: String(actorId),
    username: "tester",
    name: "Tester",
    role: "USER",
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
      joinedAt: "2024-01-01",
      createdById: actorId,
      ...overrides,
    },
  });
}

describe("lib/member/queries listMembers", () => {
  let branch: { id: number; path: string };
  let leafA: { id: number; path: string };
  let leafB: { id: number; path: string };

  beforeAll(async () => {
    const actor = await db.user.create({
      data: { username: "member-queries-actor", passwordHash: "x", name: "Actor" },
    });
    actorId = actor.id;

    const organization = await db.organization.create({ data: { name: "Member Queries Test Org" } });
    for (const [depth, name] of ["Root", "Branch", "Leaf"].entries()) {
      await db.level.create({ data: { organizationId: organization.id, depth, name } });
    }
    const rootRow = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "" },
    });
    const root = await db.group.update({ where: { id: rootRow.id }, data: { path: `${rootRow.id}/` } });

    const branchRow = await db.group.create({
      data: { organizationId: organization.id, parentId: root.id, depth: 1, name: "Branch", path: "" },
    });
    branch = await db.group.update({
      where: { id: branchRow.id },
      data: { path: `${root.path}${branchRow.id}/` },
    });

    const leafARow = await db.group.create({
      data: { organizationId: organization.id, parentId: branch.id, depth: 2, name: "Leaf A", path: "" },
    });
    leafA = await db.group.update({
      where: { id: leafARow.id },
      data: { path: `${branch.path}${leafARow.id}/` },
    });

    const leafBRow = await db.group.create({
      data: { organizationId: organization.id, parentId: branch.id, depth: 2, name: "Leaf B", path: "" },
    });
    leafB = await db.group.update({
      where: { id: leafBRow.id },
      data: { path: `${branch.path}${leafBRow.id}/` },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("only returns members within the caller's scope", async () => {
    await makeMember(leafA.id, { name: "Scope A" });
    await makeMember(leafB.id, { name: "Scope B" });

    const session = sessionAt(leafA.id, leafA.path);
    const { members, total } = await listMembers(session, { search: "Scope" });

    expect(total).toBe(1);
    expect(members).toHaveLength(1);
    expect(members[0].name).toBe("Scope A");
  });

  it("filters by status", async () => {
    await makeMember(leafA.id, { name: "Filter Active", status: "AKTIF" });
    await makeMember(leafA.id, { name: "Filter Exited", status: "KELUAR", exitedAt: "2025-01-01" });

    const session = sessionAt(branch.id, branch.path);
    const { members } = await listMembers(session, { search: "Filter", status: "KELUAR" });

    expect(members.map((m) => m.name)).toEqual(["Filter Exited"]);
  });

  it("excludes soft-deleted members", async () => {
    const member = await makeMember(leafA.id, { name: "Will Be Deleted" });
    await db.member.update({ where: { id: member.id }, data: { deletedAt: new Date() } });

    const session = sessionAt(branch.id, branch.path);
    const { members } = await listMembers(session, { search: "Will Be Deleted" });

    expect(members).toHaveLength(0);
  });

  it("throws NotFoundError when the group filter is outside scope", async () => {
    const session = sessionAt(leafA.id, leafA.path);
    await expect(listMembers(session, { groupId: leafB.id })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("paginates: page 3 of 120 shows members 101-120 with the total count", async () => {
    const organization = await db.organization.create({ data: { name: "Pagination Test Org" } });
    for (const [depth, name] of ["Root", "Leaf"].entries()) {
      await db.level.create({ data: { organizationId: organization.id, depth, name } });
    }
    const rootRow = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "PgRoot", path: "" },
    });
    const root = await db.group.update({ where: { id: rootRow.id }, data: { path: `${rootRow.id}/` } });

    for (let i = 1; i <= 120; i++) {
      const label = String(i).padStart(3, "0");
      await makeMember(root.id, { name: `Pg ${label}` });
    }

    const session = sessionAt(root.id, root.path);
    const { members, total, page, pageSize } = await listMembers(session, {
      page: 3,
      search: "Pg ",
    });

    expect(total).toBe(120);
    expect(page).toBe(3);
    expect(pageSize).toBe(50);
    expect(members).toHaveLength(20);
    expect(members[0].name).toBe("Pg 101");
    expect(members[19].name).toBe("Pg 120");
  });
});
