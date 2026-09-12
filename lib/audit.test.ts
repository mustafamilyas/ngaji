import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { audit } from "./audit";

describe("audit", () => {
  let userId: number;
  let groupId: number;

  beforeAll(async () => {
    const organization = await db.organization.create({ data: { name: "Audit Test Org" } });
    const group = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "0/" },
    });
    groupId = group.id;
    const user = await db.user.create({
      data: { username: "audit-actor", passwordHash: "x", name: "Audit Actor" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("strips passwordHash from the after snapshot", async () => {
    await db.$transaction((tx) =>
      audit(tx, {
        actorId: userId,
        action: "user.reset_password",
        entity: "User",
        entityId: userId,
        groupId,
        after: { id: userId, username: "audit-actor", passwordHash: "super-secret-hash" },
      }),
    );

    const entry = await db.auditLog.findFirst({
      where: { action: "user.reset_password", actorId: userId },
      orderBy: { id: "desc" },
    });

    expect(entry?.after).toMatchObject({ id: userId, username: "audit-actor" });
    expect(entry?.after).not.toHaveProperty("passwordHash");
  });

  it("strips any field whose name starts with 'password', not only passwordHash", async () => {
    await db.$transaction((tx) =>
      audit(tx, {
        actorId: userId,
        action: "user.create",
        entity: "User",
        entityId: userId,
        after: { username: "audit-actor", passwordTemp: "temp-plaintext", passwordResetAt: "2026-01-01" },
      }),
    );

    const entry = await db.auditLog.findFirst({
      where: { action: "user.create", actorId: userId },
      orderBy: { id: "desc" },
    });

    expect(entry?.after).not.toHaveProperty("passwordTemp");
    expect(entry?.after).not.toHaveProperty("passwordResetAt");
  });

  it("redacts nested password fields inside before/after", async () => {
    await db.$transaction((tx) =>
      audit(tx, {
        actorId: userId,
        action: "user.update_role",
        before: { user: { username: "audit-actor", passwordHash: "old-hash" } },
      }),
    );

    const entry = await db.auditLog.findFirst({
      where: { action: "user.update_role", actorId: userId },
      orderBy: { id: "desc" },
    });

    const before = entry?.before as { user?: Record<string, unknown> };
    expect(before.user).not.toHaveProperty("passwordHash");
    expect(before.user).toMatchObject({ username: "audit-actor" });
  });

  it("allows actorId null, for a failed login with an unknown username", async () => {
    await db.$transaction((tx) =>
      audit(tx, {
        actorId: null,
        action: "auth.login_failed",
        meta: { username: "nobody" },
      }),
    );

    const entry = await db.auditLog.findFirst({
      where: { action: "auth.login_failed", actorId: null },
      orderBy: { id: "desc" },
    });

    expect(entry).toMatchObject({ actorId: null, meta: { username: "nobody" } });
  });

  it("stores ip, userAgent and a createdAt timestamp", async () => {
    await db.$transaction((tx) =>
      audit(tx, {
        actorId: userId,
        action: "auth.login",
        ip: "203.0.113.1",
        userAgent: "vitest",
      }),
    );

    const entry = await db.auditLog.findFirst({
      where: { action: "auth.login", actorId: userId },
      orderBy: { id: "desc" },
    });

    expect(entry?.ip).toBe("203.0.113.1");
    expect(entry?.userAgent).toBe("vitest");
    expect(entry?.createdAt).toBeInstanceOf(Date);
  });
});
