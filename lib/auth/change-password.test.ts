import bcrypt from "bcrypt";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { changePassword } from "./change-password";

const TEST_BCRYPT_COST = 4;

describe("changePassword", () => {
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
});
