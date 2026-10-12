import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/font/google", () => ({
  Roboto: () => ({ variable: "" }),
  Geist_Mono: () => ({ variable: "" }),
}));
vi.mock("@/lib/organization", () => ({ getOrganizationName: vi.fn() }));
vi.mock("./globals.css", () => ({}));

import { auth } from "@/auth";
import { getOrganizationName } from "@/lib/organization";
import { generateMetadata } from "./layout";

describe("root generateMetadata", () => {
  beforeEach(() => {
    vi.mocked(getOrganizationName).mockReset();
    vi.mocked(getOrganizationName).mockResolvedValue("Pengajian Al-Ikhlas");
  });

  it("uses the Dahan title and never reads the organization for public pages", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const { title } = await generateMetadata();
    expect(title).toEqual({ default: "Dahan", template: "%s · Dahan" });
    expect(getOrganizationName).not.toHaveBeenCalled();
  });

  it("puts the organization name first for logged-in pages", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1" } } as never);
    const { title } = await generateMetadata();
    expect(title).toEqual({
      default: "Pengajian Al-Ikhlas · Dahan",
      template: "%s · Pengajian Al-Ikhlas",
    });
  });
});
