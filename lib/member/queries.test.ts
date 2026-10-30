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

  it("filters to the union of several selected groups", async () => {
    await makeMember(leafA.id, { name: "Union A" });
    await makeMember(leafB.id, { name: "Union B" });

    const session = sessionAt(branch.id, branch.path);
    const onlyA = await listMembers(session, { search: "Union", groupIds: [leafA.id] });
    const both = await listMembers(session, { search: "Union", groupIds: [leafA.id, leafB.id] });

    expect(onlyA.members.map((m) => m.name)).toEqual(["Union A"]);
    expect(both.members.map((m) => m.name)).toEqual(["Union A", "Union B"]);
  });

  it("throws NotFoundError when the group filter is outside scope", async () => {
    const session = sessionAt(leafA.id, leafA.path);
    await expect(listMembers(session, { groupIds: [leafB.id] })).rejects.toBeInstanceOf(NotFoundError);
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

    // A page past the end (e.g. a stale link after filtering) shows the last page instead of nothing.
    const pastEnd = await listMembers(session, { page: 9, search: "Pg " });
    expect(pastEnd.page).toBe(3);
    expect(pastEnd.members[0].name).toBe("Pg 101");
  });

  describe("tags", () => {
    let tagSeq = 0;
    const makeTag = (groupId: number, key: string, value: string | null = null, deletedAt: Date | null = null) =>
      db.tag.create({ data: { groupId, key, value, color: "blue", createdById: actorId, deletedAt } });
    const link = (memberId: number, tagId: number) =>
      db.memberTag.create({ data: { memberId, tagId, createdById: actorId } });
    const names = (members: { name: string }[]) => members.map((m) => m.name).sort();

    it("matches members with any selected tag, ANDed with the other filters, without duplicates", async () => {
      const label = `any${++tagSeq}`;
      const focus = await makeTag(branch.id, `${label}-fokus`);
      const prio = await makeTag(branch.id, `${label}-prio`, "tinggi");
      const m1 = await makeMember(leafA.id, { name: `${label} M1` });
      const m2 = await makeMember(leafA.id, { name: `${label} M2` });
      const both = await makeMember(leafB.id, { name: `${label} M3 both` });
      await makeMember(leafA.id, { name: `${label} M4 none` });
      await link(m1.id, focus.id);
      await link(m2.id, prio.id);
      await link(both.id, focus.id);
      await link(both.id, prio.id);

      const session = sessionAt(branch.id, branch.path);
      const result = await listMembers(session, { search: label, tagIds: [focus.id, prio.id] });
      expect(names(result.members)).toEqual([`${label} M1`, `${label} M2`, `${label} M3 both`]);
      expect(result.total).toBe(3);

      const narrowed = await listMembers(session, { search: "M3", tagIds: [focus.id] });
      expect(names(narrowed.members)).toEqual([`${label} M3 both`]);
    });

    it("never widens the scope: an ancestor's tag on members outside the caller's scope adds nothing", async () => {
      const label = `scope${++tagSeq}`;
      const tag = await makeTag(branch.id, `${label}-fokus`);
      const mine = await makeMember(leafA.id, { name: `${label} mine` });
      const theirs = await makeMember(leafB.id, { name: `${label} theirs` });
      await link(mine.id, tag.id);
      await link(theirs.id, tag.id);

      const { members } = await listMembers(sessionAt(leafA.id, leafA.path), { tagIds: [tag.id] });
      expect(names(members)).toEqual([`${label} mine`]);
    });

    it("drops tag ids that are invisible or deleted, and treats a filter with none left as empty", async () => {
      const label = `drop${++tagSeq}`;
      const visible = await makeTag(branch.id, `${label}-visible`);
      const sibling = await makeTag(leafB.id, `${label}-sibling`);
      const deleted = await makeTag(leafA.id, `${label}-gone`, null, new Date());
      const tagged = await makeMember(leafA.id, { name: `${label} tagged` });
      const plain = await makeMember(leafA.id, { name: `${label} plain` });
      await link(tagged.id, visible.id);
      await link(plain.id, sibling.id);
      await link(plain.id, deleted.id);

      const session = sessionAt(leafA.id, leafA.path);
      const filtered = await listMembers(session, { search: label, tagIds: [visible.id, sibling.id, deleted.id, 999_999] });
      expect(names(filtered.members)).toEqual([`${label} tagged`]);

      const none = await listMembers(session, { search: label, tagIds: [sibling.id, deleted.id] });
      expect(names(none.members)).toEqual([`${label} plain`, `${label} tagged`]);
    });

    it("includes only the tag links the caller may see, ordered by key then value", async () => {
      const label = `inc${++tagSeq}`;
      const b = await makeTag(branch.id, `${label}-b`, "z");
      const a2 = await makeTag(leafA.id, `${label}-a`, "2");
      const a1 = await makeTag(leafA.id, `${label}-a`, "1");
      const sibling = await makeTag(leafB.id, `${label}-sibling`);
      const deleted = await makeTag(leafA.id, `${label}-gone`, null, new Date());
      const member = await makeMember(leafA.id, { name: `${label} member` });
      for (const t of [b, a2, a1, sibling, deleted]) await link(member.id, t.id);

      const { members } = await listMembers(sessionAt(leafA.id, leafA.path), { search: label });
      expect(members[0].tags.map((l) => [l.tag.key, l.tag.value])).toEqual([
        [`${label}-a`, "1"],
        [`${label}-a`, "2"],
        [`${label}-b`, "z"],
      ]);
      expect(members[0].tags[0].tag).toMatchObject({ id: a1.id, color: "blue", groupId: leafA.id });
    });
  });
});
