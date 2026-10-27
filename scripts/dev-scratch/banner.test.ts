import { describe, expect, it } from "vitest";
import { formatBanner } from "./banner";

const base = { baseUrl: "http://localhost:3100", dbPath: "/tmp/dahan-scratch-x/scratch.db", keep: false };

describe("formatBanner", () => {
  it("names the URL and every seeded login", () => {
    const text = formatBanner(base);
    expect(text).toContain("http://localhost:3100");
    for (const login of ["admin / admin", "admin_desa / desa123", "user_kelompok / user123", "admin_annur / annur123"]) {
      expect(text).toContain(login);
    }
  });

  it("says the database is deleted on exit by default and that prisma/dev.db is untouched", () => {
    const text = formatBanner(base);
    expect(text).toMatch(/dihapus|deleted/i);
    expect(text).toContain("prisma/dev.db");
  });

  it("prints the database path to keep when --keep is used", () => {
    const text = formatBanner({ ...base, keep: true });
    expect(text).toContain("/tmp/dahan-scratch-x/scratch.db");
    expect(text).toMatch(/kept|dipertahankan|tidak dihapus/i);
  });
});
