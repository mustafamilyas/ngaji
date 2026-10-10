import bcrypt from "bcrypt";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { changePassword } from "./change-password";

const TEST_BCRYPT_COST = 4;

describe("changePassword", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("updates the hash and clears mustChangePassword on the correct current password", async () => {
    const oldHash = await bcrypt.hash("old-password", TEST_BCRYPT_COST);
    const user = await db.user.create({
      data: {
        username: "change-ok",
        passwordHash: oldHash,
        name: "Change Ok",
        mustChangePassword: true,
      },
    });

    const result = await changePassword(user.id, "old-password", "new-password-123");

    expect(result).toEqual({ ok: true });
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.mustChangePassword).toBe(false);
    expect(await bcrypt.compare("new-password-123", updated.passwordHash)).toBe(true);
  });

  it("rejects and leaves the hash unchanged on a wrong current password", async () => {
    const oldHash = await bcrypt.hash("old-password", TEST_BCRYPT_COST);
    const user = await db.user.create({
      data: { username: "change-wrong", passwordHash: oldHash, name: "Change Wrong" },
    });

    const result = await changePassword(user.id, "not-the-current-password", "new-password-123");

    expect(result.ok).toBe(false);
    const unchanged = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(unchanged.passwordHash).toBe(oldHash);
  });

  it("writes a user.change_password audit entry without the password hash", async () => {
    const oldHash = await bcrypt.hash("old-password", TEST_BCRYPT_COST);
    const user = await db.user.create({
      data: { username: "change-audited", passwordHash: oldHash, name: "Change Audited" },
    });

    await changePassword(user.id, "old-password", "new-password-123");

    const entry = await db.auditLog.findFirst({
      where: { action: "user.change_password", actorId: user.id },
      orderBy: { id: "desc" },
    });
    expect(entry).toMatchObject({ actorId: user.id, entity: "User", entityId: user.id });
    expect(entry?.meta).toMatchObject({ username: "change-audited" });
    expect(JSON.stringify(entry)).not.toContain(oldHash);
  });

  it("increments sessionVersion so every existing session ends", async () => {
    const user = await db.user.create({
      data: {
        username: "change-version",
        passwordHash: await bcrypt.hash("old-password", TEST_BCRYPT_COST),
        name: "Change Version",
      },
    });

    await changePassword(user.id, "old-password", "new-password-123");

    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.sessionVersion).toBe(user.sessionVersion + 1);
  });

  it("does not bump sessionVersion on a wrong current password", async () => {
    const user = await db.user.create({
      data: {
        username: "change-noversion",
        passwordHash: await bcrypt.hash("old-password", TEST_BCRYPT_COST),
        name: "No Version",
      },
    });

    await changePassword(user.id, "wrong", "new-password-123");

    const unchanged = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(unchanged.sessionVersion).toBe(user.sessionVersion);
  });

  it("audits a wrong current password as auth.login_failed with reason change_password", async () => {
    const user = await db.user.create({
      data: {
        username: "change-failed-audit",
        passwordHash: await bcrypt.hash("old-password", TEST_BCRYPT_COST),
        name: "Failed Audit",
      },
    });

    await changePassword(user.id, "wrong", "new-password-123", { ip: "203.0.113.80", userAgent: null });

    const entry = await db.auditLog.findFirst({
      where: { action: "auth.login_failed", actorId: user.id },
    });
    expect(entry?.meta).toEqual({ username: "change-failed-audit", reason: "change_password" });
    expect(entry?.ip).toBe("203.0.113.80");
  });

  it("guessing the current password is limited: the sixth attempt is refused without comparing", async () => {
    const user = await db.user.create({
      data: {
        username: "change-limited",
        passwordHash: await bcrypt.hash("old-password", TEST_BCRYPT_COST),
        name: "Limited",
      },
    });
    for (let i = 0; i < 5; i++) await changePassword(user.id, "wrong", "new-password-123");

    const compare = vi.spyOn(bcrypt, "compare");
    const result = await changePassword(user.id, "old-password", "new-password-123");

    expect(result.ok).toBe(false);
    expect(compare).not.toHaveBeenCalled();
    const unchanged = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare("old-password", unchanged.passwordHash)).toBe(true);
  });
});
