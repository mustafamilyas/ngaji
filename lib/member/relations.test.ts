import { describe, expect, it } from "vitest";
import { canonicalPair, compareRelatives, relationLabel } from "./relations";

describe("canonicalPair", () => {
  it.each(["ORANG_TUA", "WALI"] as const)("keeps the given direction for %s", (type) => {
    expect(canonicalPair(type, 9, 3)).toEqual({ fromMemberId: 9, toMemberId: 3 });
  });

  it.each(["PASANGAN", "SAUDARA"] as const)("puts the smaller id first for %s", (type) => {
    expect(canonicalPair(type, 9, 3)).toEqual({ fromMemberId: 3, toMemberId: 9 });
    expect(canonicalPair(type, 3, 9)).toEqual({ fromMemberId: 3, toMemberId: 9 });
  });
});

describe("relationLabel", () => {
  // Rows of the member-relations spec type table. `side` is the viewed member's side;
  // the label names the relative.
  it.each([
    ["ORANG_TUA", "from", "L", "Anak laki-laki"],
    ["ORANG_TUA", "from", "P", "Anak perempuan"],
    ["ORANG_TUA", "to", "L", "Ayah"],
    ["ORANG_TUA", "to", "P", "Ibu"],
    ["WALI", "from", "L", "Anak asuh"],
    ["WALI", "from", "P", "Anak asuh"],
    ["WALI", "to", "L", "Wali"],
    ["WALI", "to", "P", "Wali"],
    ["PASANGAN", "from", "L", "Suami"],
    ["PASANGAN", "from", "P", "Istri"],
    ["PASANGAN", "to", "L", "Suami"],
    ["PASANGAN", "to", "P", "Istri"],
    ["SAUDARA", "from", "L", "Saudara laki-laki"],
    ["SAUDARA", "from", "P", "Saudara perempuan"],
    ["SAUDARA", "to", "L", "Saudara laki-laki"],
    ["SAUDARA", "to", "P", "Saudara perempuan"],
  ] as const)("%s seen from the %s side, relative %s → %s", (type, side, sex, label) => {
    expect(relationLabel(type, side, sex)).toBe(label);
  });
});

describe("compareRelatives", () => {
  it("orders parents/guardians, spouse, siblings, then children/wards, each by name", () => {
    const relatives = [
      { name: "Zaid", type: "ORANG_TUA", side: "from" },
      { name: "Hasan", type: "SAUDARA", side: "to" },
      { name: "Aisyah", type: "WALI", side: "from" },
      { name: "Umar", type: "WALI", side: "to" },
      { name: "Siti", type: "PASANGAN", side: "from" },
      { name: "Ahmad", type: "ORANG_TUA", side: "to" },
      { name: "Bilal", type: "SAUDARA", side: "from" },
    ] as const;

    expect([...relatives].sort(compareRelatives).map((r) => r.name)).toEqual([
      "Ahmad",
      "Umar",
      "Siti",
      "Bilal",
      "Hasan",
      "Aisyah",
      "Zaid",
    ]);
  });

  it("compares names case-insensitively", () => {
    const a = { name: "ahmad", type: "SAUDARA", side: "to" } as const;
    const b = { name: "Bilal", type: "SAUDARA", side: "to" } as const;
    expect(compareRelatives(a, b)).toBeLessThan(0);
  });
});
