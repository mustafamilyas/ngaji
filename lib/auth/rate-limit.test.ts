import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { isLoginRateLimited } from "./rate-limit";

async function failedLogin(username: string, ip: string | null, minutesAgo: number) {
  await db.auditLog.create({
    data: {
      action: "auth.login_failed",
      meta: { username },
      ip,
      createdAt: new Date(Date.now() - minutesAgo * 60_000),
    },
  });
}

describe("isLoginRateLimited", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("is not limited with fewer than 5 recent failures for the username", async () => {
    for (let i = 0; i < 4; i++) {
      await failedLogin("empat-gagal", null, 1);
    }
    expect(await isLoginRateLimited("empat-gagal", null)).toBe(false);
  });

  it("blocks the sixth attempt after 5 failures for the same username within 15 minutes", async () => {
    for (let i = 0; i < 5; i++) {
      await failedLogin("lima-gagal", null, 1);
    }
    expect(await isLoginRateLimited("lima-gagal", null)).toBe(true);
  });

  it("allows a new attempt once the oldest failure is older than 15 minutes", async () => {
    for (let i = 0; i < 5; i++) {
      await failedLogin("expired-gagal", null, 20);
    }
    expect(await isLoginRateLimited("expired-gagal", null)).toBe(false);
  });

  it("blocks after 20 failures from the same IP even across different usernames", async () => {
    for (let i = 0; i < 20; i++) {
      await failedLogin(`user-${i}`, "198.51.100.9", 1);
    }
    expect(await isLoginRateLimited("someone-else", "198.51.100.9")).toBe(true);
  });

  it("does not block a different IP with fewer than 20 failures", async () => {
    for (let i = 0; i < 19; i++) {
      await failedLogin(`another-${i}`, "198.51.100.10", 1);
    }
    expect(await isLoginRateLimited("someone-else", "198.51.100.10")).toBe(false);
  });
});
