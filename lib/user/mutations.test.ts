import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { createUser, moveUser, resetUserPassword, setUserActive, updateUserRole } from "./mutations";

function sessionAs(
  actorId: number,
  role: SessionUser["role"],
  groupId: number,
  groupPath: string,
): SessionUser {
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

describe("lib/user/mutations", () => {
  let root: { id: number; path: string };
  let branchA: { id: number; path: string };
  let branchB: { id: number; path: string };
  let leafA: { id: number; path: string };

  let rootOwner: { id: number };
  let rootOwner2: { id: number };
  let branchAdmin: { id: number };
  let peerAdmin: { id: number };
  let leafUser: { id: number };

  beforeAll(async () => {
    const organization = await db.organization.create({ data: { name: "User Mutations Test Org" } });
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

    rootOwner = await db.user.create({ data: { username: "user-mut-root-owner", passwordHash: "x", name: "Root Owner" } });
    await db.userGroupRole.create({ data: { userId: rootOwner.id, groupId: root.id, role: "OWNER" } });

    rootOwner2 = await db.user.create({ data: { username: "user-mut-root-owner-2", passwordHash: "x", name: "Root Owner 2" } });
    await db.userGroupRole.create({ data: { userId: rootOwner2.id, groupId: root.id, role: "OWNER" } });

    branchAdmin = await db.user.create({ data: { username: "user-mut-branch-admin", passwordHash: "x", name: "Branch Admin" } });
    await db.userGroupRole.create({ data: { userId: branchAdmin.id, groupId: branchA.id, role: "ADMIN" } });

    peerAdmin = await db.user.create({ data: { username: "user-mut-peer-admin", passwordHash: "x", name: "Peer Admin" } });
    await db.userGroupRole.create({ data: { userId: peerAdmin.id, groupId: branchA.id, role: "ADMIN" } });

    leafUser = await db.user.create({ data: { username: "user-mut-leaf-user", passwordHash: "x", name: "Leaf User" } });
    await db.userGroupRole.create({ data: { userId: leafUser.id, groupId: leafA.id, role: "USER" } });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("createUser", () => {
    it("lets OWNER create an OWNER account, with a one-time temporary password", async () => {
      const session = sessionAs(rootOwner.id, "OWNER", root.id, root.path);
      const { user, temporaryPassword } = await createUser(session, {
        groupId: branchA.id,
        username: "new-owner-by-owner",
        name: "New Owner",
        role: "OWNER",
      });
      expect(user.mustChangePassword).toBe(true);
      expect(temporaryPassword.length).toBeGreaterThanOrEqual(8);
    });

    it("rejects an ADMIN creating an OWNER account", async () => {
      const session = sessionAs(branchAdmin.id, "ADMIN", branchA.id, branchA.path);
      await expect(
        createUser(session, { groupId: branchA.id, username: "nope-owner", name: "Nope", role: "OWNER" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("lets ADMIN create a USER account in scope, audited without the password", async () => {
      const session = sessionAs(branchAdmin.id, "ADMIN", branchA.id, branchA.path);
      const { user, temporaryPassword } = await createUser(session, {
        groupId: leafA.id,
        username: "new-user-by-admin",
        name: "New User",
        role: "USER",
      });

      const entry = await db.auditLog.findFirst({ where: { action: "user.create", entityId: user.id } });
      expect(entry).toMatchObject({ entity: "User", groupId: leafA.id });
      expect(entry?.after).not.toHaveProperty("passwordHash");
      expect(JSON.stringify(entry)).not.toContain(temporaryPassword);
    });

    it("rejects a duplicate username", async () => {
      const session = sessionAs(rootOwner.id, "OWNER", root.id, root.path);
      await createUser(session, { groupId: branchA.id, username: "dup-username", name: "First", role: "USER" });
      await expect(
        createUser(session, { groupId: branchA.id, username: "dup-username", name: "Second", role: "USER" }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("resetUserPassword", () => {
    it("lets OWNER reset a user in a child group", async () => {
      const session = sessionAs(rootOwner.id, "OWNER", root.id, root.path);
      const { temporaryPassword } = await resetUserPassword(session, { userId: leafUser.id });
      expect(temporaryPassword.length).toBeGreaterThanOrEqual(8);
      const updated = await db.user.findUnique({ where: { id: leafUser.id } });
      expect(updated?.mustChangePassword).toBe(true);
    });

    it("rejects ADMIN resetting a peer ADMIN in the same group", async () => {
      const session = sessionAs(branchAdmin.id, "ADMIN", branchA.id, branchA.path);
      await expect(resetUserPassword(session, { userId: peerAdmin.id })).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("rejects ADMIN resetting a USER in a child group", async () => {
      const session = sessionAs(branchAdmin.id, "ADMIN", branchA.id, branchA.path);
      await expect(resetUserPassword(session, { userId: leafUser.id })).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("never writes the temporary password to the audit log", async () => {
      const session = sessionAs(rootOwner.id, "OWNER", root.id, root.path);
      const { temporaryPassword } = await resetUserPassword(session, { userId: branchAdmin.id });
      const entry = await db.auditLog.findFirst({
        where: { action: "user.reset_password", entityId: branchAdmin.id },
        orderBy: { id: "desc" },
      });
      expect(JSON.stringify(entry)).not.toContain(temporaryPassword);
    });
  });

  describe("moveUser", () => {
    it("throws NotFoundError when the destination group is outside the caller's scope", async () => {
      const session = sessionAs(branchAdmin.id, "OWNER", branchA.id, branchA.path);
      await expect(
        moveUser(session, { userId: leafUser.id, groupId: branchB.id }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("moves a user within scope and audits before/after groupId", async () => {
      const session = sessionAs(rootOwner.id, "OWNER", root.id, root.path);
      const moved = await moveUser(session, { userId: leafUser.id, groupId: branchA.id });
      expect(moved.groupId).toBe(branchA.id);

      const entry = await db.auditLog.findFirst({
        where: { action: "user.move", entityId: leafUser.id },
        orderBy: { id: "desc" },
      });
      expect(entry).toMatchObject({ before: { groupId: leafA.id }, after: { groupId: branchA.id } });

      // Move back so later tests can rely on leafUser living at leafA.
      await moveUser(session, { userId: leafUser.id, groupId: leafA.id });
    });
  });

  describe("updateUserRole / setUserActive self-protection", () => {
    it("rejects a user changing their own role", async () => {
      const session = sessionAs(rootOwner.id, "OWNER", root.id, root.path);
      await expect(updateUserRole(session, { userId: rootOwner.id, role: "ADMIN" })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it("rejects a user deactivating themselves", async () => {
      const session = sessionAs(rootOwner.id, "OWNER", root.id, root.path);
      await expect(setUserActive(session, { userId: rootOwner.id, isActive: false })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });
  });

  describe("last active root OWNER", () => {
    it("allows deactivating one of two active root OWNERs", async () => {
      const session = sessionAs(rootOwner.id, "OWNER", root.id, root.path);
      const updated = await setUserActive(session, { userId: rootOwner2.id, isActive: false });
      expect(updated.isActive).toBe(false);
    });

    it("rejects deactivating the sole remaining active root OWNER", async () => {
      // rootOwner2 is now inactive; rootOwner is the last active root OWNER.
      // A different actor (not rootOwner) isolates the last-owner rule from self-protection.
      const session = sessionAs(rootOwner2.id, "OWNER", root.id, root.path);
      await expect(setUserActive(session, { userId: rootOwner.id, isActive: false })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it("rejects demoting the sole remaining active root OWNER away from OWNER", async () => {
      const session = sessionAs(rootOwner2.id, "OWNER", root.id, root.path);
      await expect(updateUserRole(session, { userId: rootOwner.id, role: "ADMIN" })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });
  });
});
