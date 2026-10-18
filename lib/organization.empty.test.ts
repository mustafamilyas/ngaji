import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { organization: { findFirst: vi.fn().mockResolvedValue(null) } },
}));

import { getOrganizationName } from "./organization";

describe("getOrganizationName without an organization", () => {
  it('falls back to "Dahan"', async () => {
    expect(await getOrganizationName()).toBe("Dahan");
  });
});
