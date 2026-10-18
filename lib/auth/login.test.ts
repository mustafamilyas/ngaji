import bcrypt from "bcrypt";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/http";
import { attemptLogin } from "./login";

const TEST_BCRYPT_COST = 4;
const CONTEXT = { ip: "203.0.113.50", userAgent: "vitest" };

async function failedLogin(username: string, ip: string | null, minutesAgo = 1) {
  await db.auditLog.create({
    data: {
      action: "auth.login_failed",
      meta: { username },
      ip,
      createdAt: new Date(Date.now() - minutesAgo * 60_000),
    },
  });
}

describe("attemptLogin", () => {
  beforeAll(async () => {
    const organization = await db.organization.create({ data: { name: "Login Org" } });
    const group = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "login-0/" },
    });
    const passwordHash = await bcrypt.hash("correct-password", TEST_BCRYPT_COST);
    for (const username of ["login-budi", "burst", "window", "ipfriend"]) {
      const user = await db.user.create({ data: { username, passwordHash, name: username } });
      await db.userGroupRole.create({ data: { userId: user.id, groupId: group.id, role: "USER" } });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("logs in with a whitespace-padded username and audits the normalized one", async () => {
    const result = await attemptLogin({ username: " login-budi ", password: "correct-password" }, CONTEXT);

    expect(result.ok).toBe(true);
    const row = await db.auditLog.findFirst({
      where: { action: "auth.login" },
      orderBy: { id: "desc" },
    });
    expect(row?.meta).toEqual({ username: "login-budi" });
  });

  it("whitespace variant is still limited", async () => {
    for (let i = 0; i < 5; i++) await failedLogin("budi-limited", null);
    await db.user.create({
      data: {
        username: "budi-limited",
        passwordHash: await bcrypt.hash("correct-password", TEST_BCRYPT_COST),
        name: "x",
      },
    });

    const compare = vi.spyOn(bcrypt, "compare");
    const result = await attemptLogin(
      { username: "budi-limited ", password: "correct-password" },
      CONTEXT,
    );

    expect(result).toMatchObject({ ok: false, reason: "rate_limited", username: "budi-limited" });
    expect(compare).not.toHaveBeenCalled();
  });

  it("window expires: old failures no longer block", async () => {
    for (let i = 0; i < 5; i++) await failedLogin("window", null, 20);

    const result = await attemptLogin({ username: "window", password: "correct-password" }, CONTEXT);

    expect(result.ok).toBe(true);
  });

  it("unknown user performs a compare", async () => {
    const compare = vi.spyOn(bcrypt, "compare");

    const result = await attemptLogin({ username: "ghost", password: "whatever" }, CONTEXT);

    expect(result).toMatchObject({ ok: false, reason: "unknown_user", actorId: null });
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it("invalid input is audited under the IP only and counts toward the IP limit", async () => {
    const result = await attemptLogin({ username: "   ", password: "x" }, CONTEXT);

    expect(result).toMatchObject({ ok: false, reason: "invalid_input" });
    const row = await db.auditLog.findFirst({
      where: { action: "auth.login_failed", ip: CONTEXT.ip },
      orderBy: { id: "desc" },
    });
    expect(row?.meta).toEqual({ username: null });
  });

  it("parallel burst of 20 compares at most 5", async () => {
    const compare = vi.spyOn(bcrypt, "compare");

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        attemptLogin({ username: "burst", password: "wrong" }, { ip: "203.0.113.60", userAgent: null }),
      ),
    );

    expect(compare.mock.calls.length).toBeLessThanOrEqual(5);
    expect(results.filter((r) => !r.ok && r.reason === "rate_limited")).toHaveLength(15);
  });

  it("forged X-Forwarded-For is ignored: the real address is limited and audited", async () => {
    const realIp = "203.0.113.70";
    for (let i = 0; i < 20; i++) await failedLogin(`spray-${i}`, realIp);

    const request = new Request("http://localhost/api/auth/callback/credentials", {
      headers: { "x-forwarded-for": `10.9.9.9, ${realIp}` },
    });
    const ip = getClientIp(request);
    const result = await attemptLogin(
      { username: "ipfriend", password: "correct-password" },
      { ip, userAgent: null },
    );

    expect(result).toMatchObject({ ok: false, reason: "rate_limited" });
    const row = await db.auditLog.findFirst({
      where: { action: "auth.login_failed", ip: realIp },
      orderBy: { id: "desc" },
    });
    expect(row?.meta).toEqual({ username: "ipfriend" });
  });
});
