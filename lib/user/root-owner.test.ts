import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { sessionFor } from "@/lib/test/fixtures";
import { moveUser, setUserActive, updateUserRole } from "./mutations";

/**
 * Root-OWNER invariant (authorization spec): at least one active OWNER must
 * remain in the root group. Checked after the write, inside the transaction,
 * so concurrent requests cannot both pass a stale pre-check.
 */
describe("last active root OWNER (race-safe)", () => {
  let root: { id: number; path: string };
  let branch: { id: number; path: string };
  let ownerA: { id: number };
  let ownerB: { id: number };

  async function makeOwner(username: string) {
    const user = await db.user.create({ data: { username, passwordHash: "x", name: username } });
    await db.userGroupRole.create({ data: { userId: user.id, groupId: root.id, role: "OWNER" } });
    return user;
  }

  async function resetOwners() {
    await db.user.updateMany({ where: { id: { in: [ownerA.id, ownerB.id] } }, data: { isActive: true } });
    await db.userGroupRole.updateMany({
      where: { userId: { in: [ownerA.id, ownerB.id] } },
      data: { groupId: root.id, role: "OWNER" },
    });
  }

  beforeAll(async () => {
    const organization = await db.organization.create({ data: { name: "Root Owner Race Org" } });
    for (const [depth, name] of ["Root", "Branch"].entries()) {
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
    ownerA = await makeOwner("root-race-owner-a");
    ownerB = await makeOwner("root-race-owner-b");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects the last root owner moving themselves out of the root group", async () => {
    await resetOwners();
    await db.user.update({ where: { id: ownerB.id }, data: { isActive: false } });

    const session = sessionFor(ownerA.id, "OWNER", root);
    await expect(moveUser(session, { userId: ownerA.id, groupId: branch.id })).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const role = await db.userGroupRole.findUniqueOrThrow({ where: { userId: ownerA.id } });
    expect(role.groupId).toBe(root.id);
  });

  it("lets one of two root owners move away", async () => {
    await resetOwners();

    const session = sessionFor(ownerB.id, "OWNER", root);
    const moved = await moveUser(session, { userId: ownerA.id, groupId: branch.id });
    expect(moved.groupId).toBe(branch.id);
  });

  it("rejects demoting the last root owner and rolls the write back", async () => {
    await resetOwners();
    await db.user.update({ where: { id: ownerB.id }, data: { isActive: false } });

    const session = sessionFor(ownerB.id, "OWNER", root);
    await expect(updateUserRole(session, { userId: ownerA.id, role: "ADMIN" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const role = await db.userGroupRole.findUniqueOrThrow({ where: { userId: ownerA.id } });
    expect(role.role).toBe("OWNER");
  });

  it("concurrent mutual deactivation: exactly one succeeds", async () => {
    await resetOwners();

    const results = await Promise.allSettled([
      setUserActive(sessionFor(ownerA.id, "OWNER", root), { userId: ownerB.id, isActive: false }),
      setUserActive(sessionFor(ownerB.id, "OWNER", root), { userId: ownerA.id, isActive: false }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected && rejected.status === "rejected" && rejected.reason).toBeInstanceOf(ForbiddenError);

    const active = await db.userGroupRole.count({
      where: { groupId: root.id, role: "OWNER", user: { isActive: true } },
    });
    expect(active).toBe(1);
  });
});
