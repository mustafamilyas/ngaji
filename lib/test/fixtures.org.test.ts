import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { buildOrgFixture, buildPageFixture, fixtureCodePrefix } from "@/lib/test/fixtures";

describe("buildOrgFixture", () => {
  it("builds two organizations whose group paths never overlap", async () => {
    const a = await buildOrgFixture("orgfx-a");
    const b = await buildOrgFixture("orgfx-b", { timezone: "Asia/Makassar" });

    expect(a.organizationId).not.toBe(b.organizationId);
    expect(b.timezone).toBe("Asia/Makassar");
    expect(a.levelNames).toHaveLength(3);
    expect(b.root.path.startsWith(a.root.path)).toBe(false);
    expect(a.root.path.startsWith(b.root.path)).toBe(false);

    const inA = await db.group.count({ where: { path: { startsWith: a.owner.groupPath } } });
    const inB = await db.group.count({ where: { path: { startsWith: b.owner.groupPath } } });
    expect(inA).toBe(4);
    expect(inB).toBe(4);
    expect(a.owner.role).toBe("OWNER");
  });
});

describe("buildPageFixture", () => {
  it("gives its member a code with the organization's prefix, like every real member", async () => {
    const fx = await buildPageFixture("pagefx-code");
    const member = await db.member.findUniqueOrThrow({ where: { id: fx.memberId }, select: { code: true } });
    expect(member.code).toMatch(new RegExp(`^${fixtureCodePrefix(fx.organizationId)}-[0-9A-HJKMNP-TV-Z]{6}$`));
  });
});

describe("fixtureCodePrefix", () => {
  it("is Z plus the id in three base-26 letters, a valid prefix", () => {
    expect(fixtureCodePrefix(0)).toBe("ZAAA");
    expect(fixtureCodePrefix(5)).toBe("ZAAF");
    expect(fixtureCodePrefix(27)).toBe("ZABB");
    expect(fixtureCodePrefix(26 ** 3 - 1)).toBe("ZZZZ");
  });
});
