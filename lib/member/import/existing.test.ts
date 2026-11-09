import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { duplicateKey } from "./duplicates";
import { existingDuplicateKeys } from "./existing";

let actorId: number;
let branch: { id: number; path: string };
let leafA: { id: number; path: string };
let leafB: { id: number; path: string };

function sessionAt(group: { id: number; path: string }): SessionUser {
  return {
    id: String(actorId),
    username: "tester",
    name: "Tester",
    role: "USER",
    groupId: group.id,
    groupPath: group.path,
    organizationId: 0,
    timeZone: "Asia/Jakarta",
    mustChangePassword: false,
  };
}

function makeMember(groupId: number, name: string, birthDate: string, overrides: Record<string, unknown> = {}) {
  return db.member.create({
    data: {
      groupId,
      name,
      birthPlace: "Jakarta",
      birthDate,
      sex: "L",
      address: "-",
      maritalStatus: "BELUM_MENIKAH",
      workStatus: "BEKERJA",
      joinedAt: "2024-01-01",
      createdById: actorId,
      ...overrides,
    },
  });
}

async function makeGroup(organizationId: number, parent: { id: number; path: string } | null, depth: number, name: string) {
  const row = await db.group.create({
    data: { organizationId, parentId: parent?.id ?? null, depth, name, path: "" },
  });
  return db.group.update({ where: { id: row.id }, data: { path: `${parent?.path ?? ""}${row.id}/` } });
}

describe("lib/member/import/existing existingDuplicateKeys", () => {
  beforeAll(async () => {
    const actor = await db.user.create({
      data: { username: "import-existing-actor", passwordHash: "x", name: "Actor" },
    });
    actorId = actor.id;

    const organization = await db.organization.create({ data: { name: "Import Existing Test Org" } });
    for (const [depth, name] of ["Root", "Branch", "Leaf"].entries()) {
      await db.level.create({ data: { organizationId: organization.id, depth, name } });
    }
    const root = await makeGroup(organization.id, null, 0, "Root");
    branch = await makeGroup(organization.id, root, 1, "Branch");
    leafA = await makeGroup(organization.id, branch, 2, "Leaf A");
    leafB = await makeGroup(organization.id, branch, 2, "Leaf B");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns keys of members in scope whose birth date is asked for", async () => {
    await makeMember(leafA.id, "Siti  Aminah", "1991-02-03");
    const keys = await existingDuplicateKeys(sessionAt(leafA), ["1991-02-03"]);
    expect(keys.has(duplicateKey("siti aminah", "1991-02-03"))).toBe(true);
  });

  it("matches members in descendant groups of the user's group", async () => {
    await makeMember(leafB.id, "Descendant Match", "1992-02-03");
    const keys = await existingDuplicateKeys(sessionAt(branch), ["1992-02-03"]);
    expect(keys.has(duplicateKey("Descendant Match", "1992-02-03"))).toBe(true);
  });

  it("never returns a member outside the user's scope", async () => {
    await makeMember(leafB.id, "Outside Scope", "1993-02-03");
    const keys = await existingDuplicateKeys(sessionAt(leafA), ["1993-02-03"]);
    expect(keys.size).toBe(0);
  });

  it("never returns a soft-deleted member", async () => {
    await makeMember(leafA.id, "Soft Deleted", "1994-02-03", { deletedAt: new Date() });
    const keys = await existingDuplicateKeys(sessionAt(leafA), ["1994-02-03"]);
    expect(keys.size).toBe(0);
  });

  it("ignores members born on other dates", async () => {
    await makeMember(leafA.id, "Other Date", "1995-02-03");
    const keys = await existingDuplicateKeys(sessionAt(leafA), ["1995-02-04"]);
    expect(keys.size).toBe(0);
  });

  it("returns an empty set without querying when no dates are given", async () => {
    expect((await existingDuplicateKeys(sessionAt(leafA), [])).size).toBe(0);
  });
});
