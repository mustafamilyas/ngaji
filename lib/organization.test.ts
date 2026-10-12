import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getOrganizationName } from "./organization";

describe("getOrganizationName", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns the name of the deployment's organization", async () => {
    await db.organization.create({ data: { name: "Organization Name Test Org" } });
    const first = await db.organization.findFirstOrThrow({ orderBy: { id: "asc" } });

    expect(await getOrganizationName()).toBe(first.name);
  });
});
