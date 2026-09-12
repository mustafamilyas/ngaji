import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session-user";
import { getLevels, getMaxDepth, renameLevel } from "./levels";

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

describe("lib/group/levels", () => {
  let organizationId: number;
  let root: { id: number; path: string };
  let branch: { id: number; path: string };

  beforeAll(async () => {
    const actor = await db.user.create({
      data: { username: "levels-actor", passwordHash: "x", name: "Actor" },
    });
    actorId = actor.id;

    const organization = await db.organization.create({ data: { name: "Levels Test Org" } });
    organizationId = organization.id;
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
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("getLevels / getMaxDepth", () => {
    it("returns levels ordered by depth and the deepest depth", async () => {
      const levels = await getLevels(organizationId);
      const depths = levels.map((l) => l.depth);
      expect(depths).toEqual([...depths].sort((a, b) => a - b));
      expect(await getMaxDepth(organizationId)).toBe(Math.max(...depths));
    });
  });

  describe("renameLevel", () => {
    it("updates the name and writes a level.rename audit entry", async () => {
      const session = sessionAt("OWNER", root.id, root.path);
      const updated = await renameLevel(session, { depth: 1, name: "Cabang" });
      expect(updated.name).toBe("Cabang");

      const entry = await db.auditLog.findFirst({
        where: { action: "level.rename", entityId: updated.id },
      });
      expect(entry).toMatchObject({
        actorId,
        entity: "Level",
        before: { name: "Branch" },
        after: { name: "Cabang" },
      });
    });

    it("throws ForbiddenError for a non-root OWNER", async () => {
      const session = sessionAt("OWNER", branch.id, branch.path);
      await expect(renameLevel(session, { depth: 1, name: "Nope" })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it("throws ForbiddenError for a root ADMIN", async () => {
      const session = sessionAt("ADMIN", root.id, root.path);
      await expect(renameLevel(session, { depth: 1, name: "Nope" })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });
  });
});
