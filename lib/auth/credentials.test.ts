import bcrypt from "bcrypt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { verifyCredentials } from "./credentials";

// Low cost: these hashes only need to round-trip through bcrypt.compare in
// tests, not resist offline cracking. The app always hashes with
// lib/constants.ts BCRYPT_COST.
const TEST_BCRYPT_COST = 4;

describe("verifyCredentials", () => {
  let groupId: number;
  let activeUserId: number;
  let inactiveUserId: number;

  beforeAll(async () => {
    const organization = await db.organization.create({
      data: { name: "Test Org" },
    });
    const group = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "0/" },
    });
    groupId = group.id;

    const activeHash = await bcrypt.hash("correct-password", TEST_BCRYPT_COST);
    const activeUser = await db.user.create({
      data: { username: "active-user", passwordHash: activeHash, name: "Active User" },
    });
    activeUserId = activeUser.id;
    await db.userGroupRole.create({
      data: { userId: activeUser.id, groupId, role: "ADMIN" },
    });

    const inactiveHash = await bcrypt.hash("correct-password", TEST_BCRYPT_COST);
    const inactiveUser = await db.user.create({
      data: {
        username: "inactive-user",
        passwordHash: inactiveHash,
        name: "Inactive User",
        isActive: false,
      },
    });
    inactiveUserId = inactiveUser.id;
    await db.userGroupRole.create({
      data: { userId: inactiveUser.id, groupId, role: "USER" },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("succeeds on correct credentials for an active user", async () => {
    const result = await verifyCredentials({
      username: "active-user",
      password: "correct-password",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.user).toMatchObject({
      username: "active-user",
      name: "Active User",
      role: "ADMIN",
      groupId,
      groupPath: "0/",
      mustChangePassword: false,
    });
  });

  it("fails with reason wrong_password and the resolved actorId on a wrong password", async () => {
    const result = await verifyCredentials({
      username: "active-user",
      password: "wrong-password",
    });

    expect(result).toEqual({
      ok: false,
      reason: "wrong_password",
      actorId: activeUserId,
      username: "active-user",
    });
  });

  it("fails with reason unknown_user and actorId null for an unknown username", async () => {
    const result = await verifyCredentials({
      username: "nobody",
      password: "correct-password",
    });

    expect(result).toEqual({
      ok: false,
      reason: "unknown_user",
      actorId: null,
      username: "nobody",
    });
  });

  it("fails with reason inactive and the resolved actorId for an inactive user", async () => {
    const result = await verifyCredentials({
      username: "inactive-user",
      password: "correct-password",
    });

    expect(result).toEqual({
      ok: false,
      reason: "inactive",
      actorId: inactiveUserId,
      username: "inactive-user",
    });
  });

  it("fails with reason invalid_input when the schema rejects the input", async () => {
    const result = await verifyCredentials({ username: "", password: "" });
    expect(result).toEqual({
      ok: false,
      reason: "invalid_input",
      actorId: null,
      username: null,
    });
  });
});
