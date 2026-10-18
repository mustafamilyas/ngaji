import { describe, expect, it } from "vitest";
import { parseTab, tabHref } from "./tabs";

const TABS = ["profil", "kehadiran", "ubah"] as const;

describe("parseTab", () => {
  it("returns a known tab", () => {
    expect(parseTab("kehadiran", TABS, "profil")).toBe("kehadiran");
  });

  it("falls back for missing, unknown or repeated values", () => {
    expect(parseTab(undefined, TABS, "profil")).toBe("profil");
    expect(parseTab("admin", TABS, "profil")).toBe("profil");
    expect(parseTab(["ubah", "profil"], TABS, "profil")).toBe("profil");
  });
});

describe("tabHref", () => {
  it("omits the default tab from the URL", () => {
    expect(tabHref("/dashboard/anggota/3", "profil", "profil")).toBe("/dashboard/anggota/3");
  });

  it("sets only the tab param", () => {
    expect(tabHref("/dashboard/anggota/3", "kehadiran", "profil")).toBe("/dashboard/anggota/3?tab=kehadiran");
  });
});
