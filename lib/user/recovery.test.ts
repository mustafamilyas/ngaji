import bcrypt from "bcrypt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { revalidateSessionUser } from "@/lib/auth/revalidate";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { resetOwnerPassword } from "./recovery";

describe("lib/user/recovery resetOwnerPassword", () => {
  let owner: { id: number };
  let admin: { id: number };

  beforeAll(async () => {
    const organization = await db.organization.create({ data: { name: "Recovery Test Org" } });
    await db.level.create({ data: { organizationId: organization.id, depth: 0, name: "Root" } });
    const rootRow = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "" },
    });
    const root = await db.group.update({ where: { id: rootRow.id }, data: { path: `${rootRow.id}/` } });

    owner = await db.user.create({
      data: { username: "recovery-owner", passwordHash: "old-hash", name: "Recovery Owner", isActive: false },
    });
    await db.userGroupRole.create({ data: { userId: owner.id, groupId: root.id, role: "OWNER" } });

    admin = await db.user.create({ data: { username: "recovery-admin", passwordHash: "x", name: "Admin" } });
    await db.userGroupRole.create({ data: { userId: admin.id, groupId: root.id, role: "ADMIN" } });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("sets a hashed temporary password that must be changed and ends old sessions", async () => {
    const before = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
    const { temporaryPassword } = await resetOwnerPassword("recovery-owner", { activate: true });

    const after = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(await bcrypt.compare(temporaryPassword, after.passwordHash)).toBe(true);
    expect(after.mustChangePassword).toBe(true);
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect(await revalidateSessionUser(owner.id, before.sessionVersion)).toBeNull();
  });

  it("audits a CLI reset with no actor and without the password", async () => {
    const { temporaryPassword } = await resetOwnerPassword("recovery-owner", { activate: false });
    const entry = await db.auditLog.findFirst({
      where: { action: "user.reset_password", entityId: owner.id },
      orderBy: { id: "desc" },
    });
    expect(entry).toMatchObject({ actorId: null, entity: "User", meta: { via: "cli", username: "recovery-owner" } });
    expect(JSON.stringify(entry)).not.toContain(temporaryPassword);
  });

  it("reactivates only with --activate", async () => {
    await db.user.update({ where: { id: owner.id }, data: { isActive: false } });

    await resetOwnerPassword("recovery-owner", { activate: false });
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).isActive).toBe(false);

    await resetOwnerPassword("recovery-owner", { activate: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).isActive).toBe(true);
  });

  it("records whether the reset reactivated the account", async () => {
    await db.user.update({ where: { id: owner.id }, data: { isActive: false } });
    await resetOwnerPassword("recovery-owner", { activate: true });
    const reactivated = await db.auditLog.findFirst({
      where: { action: "user.reset_password", entityId: owner.id },
      orderBy: { id: "desc" },
    });
    expect(reactivated?.meta).toMatchObject({ activated: true });

    await resetOwnerPassword("recovery-owner", { activate: true });
    const alreadyActive = await db.auditLog.findFirst({
      where: { action: "user.reset_password", entityId: owner.id },
      orderBy: { id: "desc" },
    });
    expect(alreadyActive?.meta).toMatchObject({ activated: false });
  });

  it("matches the username case-insensitively", async () => {
    const result = await resetOwnerPassword("Recovery-Owner", { activate: false });
    expect(result.temporaryPassword).toBeTruthy();
  });

  it("rejects an unknown username and changes nothing", async () => {
    const auditCount = await db.auditLog.count();
    await expect(resetOwnerPassword("no-such-user", { activate: false })).rejects.toBeInstanceOf(ValidationError);
    expect(await db.auditLog.count()).toBe(auditCount);
  });

  it("rejects a user who is not an OWNER and changes nothing", async () => {
    const before = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    await expect(resetOwnerPassword("recovery-admin", { activate: false })).rejects.toBeInstanceOf(ValidationError);
    const after = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.sessionVersion).toBe(before.sessionVersion);
  });
});
