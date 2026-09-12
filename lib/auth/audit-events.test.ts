import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { auditLoginAttempt, auditLogout } from "./audit-events";
import type { CredentialsResult } from "./credentials";
import type { SessionUser } from "./session-user";

describe("auditLoginAttempt", () => {
  let groupId: number;
  let budiId: number;

  beforeAll(async () => {
    const organization = await db.organization.create({ data: { name: "Audit Events Org" } });
    const group = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "0/" },
    });
    groupId = group.id;
    const budi = await db.user.create({
      data: { username: "budi", passwordHash: "x", name: "Budi" },
    });
    budiId = budi.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  function sessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
    return {
      id: String(budiId),
      username: "budi",
      name: "Budi",
      role: "ADMIN",
      groupId,
      groupPath: "0/",
      mustChangePassword: false,
      ...overrides,
    };
  }

  it("writes auth.login with the actor and username on success", async () => {
    const result: CredentialsResult = { ok: true, user: sessionUser() };

    await auditLoginAttempt(result, { ip: "203.0.113.5", userAgent: "vitest" });

    const entry = await db.auditLog.findFirst({
      where: { action: "auth.login", actorId: budiId },
      orderBy: { id: "desc" },
    });
    expect(entry).toMatchObject({
      actorId: budiId,
      meta: { username: "budi" },
      ip: "203.0.113.5",
      userAgent: "vitest",
    });
  });

  it("writes auth.login_failed with actorId null for an unknown username", async () => {
    const result: CredentialsResult = {
      ok: false,
      reason: "unknown_user",
      actorId: null,
      username: "nobody",
    };

    await auditLoginAttempt(result, { ip: null, userAgent: null });

    const entry = await db.auditLog.findFirst({
      where: { action: "auth.login_failed", actorId: null },
      orderBy: { id: "desc" },
    });
    expect(entry).toMatchObject({ actorId: null, meta: { username: "nobody" } });
  });

  it("writes auth.login_failed with the resolved actorId for a wrong password", async () => {
    const result: CredentialsResult = {
      ok: false,
      reason: "wrong_password",
      actorId: budiId,
      username: "budi",
    };

    await auditLoginAttempt(result, { ip: null, userAgent: null });

    const entry = await db.auditLog.findFirst({
      where: { action: "auth.login_failed", actorId: budiId },
      orderBy: { id: "desc" },
    });
    expect(entry).toMatchObject({ actorId: budiId, meta: { username: "budi" } });
  });
});

describe("auditLogout", () => {
  let userId: number;

  beforeAll(async () => {
    const user = await db.user.create({
      data: { username: "logout-user", passwordHash: "x", name: "Logout User" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("writes an auth.logout entry for the user", async () => {
    await auditLogout(userId, "logout-user");

    const entry = await db.auditLog.findFirst({
      where: { action: "auth.logout", actorId: userId },
      orderBy: { id: "desc" },
    });
    expect(entry).toMatchObject({ actorId: userId, meta: { username: "logout-user" } });
  });
});
