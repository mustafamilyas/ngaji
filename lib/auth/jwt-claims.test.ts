import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JWT } from "@auth/core/jwt";
import { db } from "@/lib/db";
import { refreshTokenClaims } from "./jwt-claims";

describe("refreshTokenClaims", () => {
  let userId: number;

  beforeAll(async () => {
    const organization = await db.organization.create({ data: { name: "Jwt Org" } });
    const group = await db.group.create({
      data: { organizationId: organization.id, depth: 0, name: "Root", path: "jwt-0/" },
    });
    const user = await db.user.create({
      data: { username: "jwt-user", passwordHash: "x", name: "Jwt User" },
    });
    userId = user.id;
    await db.userGroupRole.create({ data: { userId, groupId: group.id, role: "USER" } });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  function tokenWith(sessionVersion: number | undefined): JWT {
    return {
      id: String(userId),
      username: "jwt-user",
      name: "Jwt User",
      role: "USER",
      groupId: 1,
      groupPath: "jwt-0/",
      mustChangePassword: false,
      sessionVersion,
    };
  }

  it("keeps a token whose sessionVersion matches", async () => {
    const result = await refreshTokenClaims(tokenWith(0));
    expect(result).not.toBeNull();
    expect(result?.sessionVersion).toBe(0);
  });

  it("update cannot adopt new version: a stale token stays revoked", async () => {
    await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });

    // `refreshTokenClaims` has no parameter through which a client-supplied
    // `update` payload could reach the version; the token's own value is
    // what gets compared.
    expect(await refreshTokenClaims(tokenWith(0))).toBeNull();
  });
});
