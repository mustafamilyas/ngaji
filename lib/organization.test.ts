import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { sessionFor } from "@/lib/test/fixtures";
import { getOrganization } from "./organization";

describe("getOrganization", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns the name and timezone of the session user's own organization, never another's", async () => {
    const orgA = await db.organization.create({ data: { name: "Org Test A", timezone: "Asia/Jakarta" } });
    const orgB = await db.organization.create({ data: { name: "Org Test B", timezone: "Asia/Jayapura" } });
    const rootB = await db.group.create({
      data: { organizationId: orgB.id, depth: 0, name: "Root B", path: "org-test-b/" },
    });

    const session = { user: sessionFor(1, "OWNER", rootB) };

    expect(await getOrganization(session)).toEqual({ name: "Org Test B", timeZone: "Asia/Jayapura" });
    expect(orgA.id).not.toBe(orgB.id);
  });

  it('falls back to "Dahan" and the session timezone when the organization row is missing', async () => {
    const session = { user: { ...sessionFor(1, "OWNER", { id: 1, path: "x/" }), organizationId: 999_999, timeZone: "Asia/Makassar" } };

    expect(await getOrganization(session)).toEqual({ name: "Dahan", timeZone: "Asia/Makassar" });
  });
});
