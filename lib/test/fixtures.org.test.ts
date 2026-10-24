import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { buildOrgFixture } from "@/lib/test/fixtures";

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
