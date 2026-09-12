import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { listAuditLog } from "./queries";

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

describe("lib/audit-log/queries listAuditLog", () => {
  let root: { id: number; path: string };
  let daerahA: { id: number; path: string };
  let daerahB: { id: number; path: string };
  let owner: { id: number };

  beforeAll(async () => {
    const organization = await db.organization.create({ data: { name: "Audit Query Test Org" } });
    for (const [depth, name] of ["Root", "Daerah"].entries()) {
      await db.level.create({ data: { organizationId: organization.id, depth, name } });
    }

    const rootRow = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "" },
    });
    root = await db.group.update({ where: { id: rootRow.id }, data: { path: `${rootRow.id}/` } });

    const daerahARow = await db.group.create({
      data: { organizationId: organization.id, parentId: root.id, depth: 1, name: "Daerah A", path: "" },
    });
    daerahA = await db.group.update({
      where: { id: daerahARow.id },
      data: { path: `${root.path}${daerahARow.id}/` },
    });

    const daerahBRow = await db.group.create({
      data: { organizationId: organization.id, parentId: root.id, depth: 1, name: "Daerah B", path: "" },
    });
    daerahB = await db.group.update({
      where: { id: daerahBRow.id },
      data: { path: `${root.path}${daerahBRow.id}/` },
    });

    owner = await db.user.create({
      data: { username: "audit-query-owner", passwordHash: "x", name: "Owner" },
    });

    await db.$transaction((tx) =>
      audit(tx, {
        actorId: owner.id,
        action: "group.update",
        entity: "Group",
        entityId: daerahA.id,
        groupId: daerahA.id,
        after: { name: "Daerah A", passwordHash: "should-never-appear" },
      }),
    );

    await db.$transaction((tx) =>
      audit(tx, {
        actorId: owner.id,
        action: "group.update",
        entity: "Group",
        entityId: daerahB.id,
        groupId: daerahB.id,
        after: { name: "Daerah B" },
      }),
    );
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects a non-OWNER with NotFoundError (audit-log spec: ADMIN denied → 404)", async () => {
    const session = sessionAs(owner.id, "ADMIN", daerahA.id, daerahA.path);
    await expect(listAuditLog(session)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("hides entries from a sibling daerah outside the caller's scope", async () => {
    const session = sessionAs(owner.id, "OWNER", daerahA.id, daerahA.path);
    const { entries } = await listAuditLog(session);
    expect(entries.some((e) => e.groupId === daerahA.id)).toBe(true);
    expect(entries.some((e) => e.groupId === daerahB.id)).toBe(false);
  });

  it("never returns a passwordHash key in an after snapshot", async () => {
    const session = sessionAs(owner.id, "OWNER", root.id, root.path);
    const { entries } = await listAuditLog(session);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.after).not.toHaveProperty("passwordHash");
    }
  });
});
