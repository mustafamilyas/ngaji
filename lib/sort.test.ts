import { describe, expect, it } from "vitest";
import { compareValues, parseSort, sortHref, sortPreserve } from "./sort";

const KEYS = ["nama", "status", "tanggalMasuk"] as const;
const DEFAULT = { key: "nama", dir: "asc" } as const;

describe("parseSort", () => {
  it("falls back for missing or unknown keys", () => {
    expect(parseSort({}, KEYS, DEFAULT)).toEqual(DEFAULT);
    expect(parseSort({ sort: "passwordHash", dir: "desc" }, KEYS, DEFAULT)).toEqual(DEFAULT);
    expect(parseSort({ sort: ["status", "nama"] }, KEYS, DEFAULT)).toEqual(DEFAULT);
  });

  it("reads a known key and direction, ascending when the direction is missing or invalid", () => {
    expect(parseSort({ sort: "status", dir: "desc" }, KEYS, DEFAULT)).toEqual({ key: "status", dir: "desc" });
    expect(parseSort({ sort: "status", dir: "sideways" }, KEYS, DEFAULT)).toEqual({ key: "status", dir: "asc" });
  });
});

describe("sortHref", () => {
  it("flips the active column and drops the page", () => {
    expect(sortHref("/dashboard/anggota", { q: "budi", page: "3" }, "nama", DEFAULT, DEFAULT)).toBe(
      "/dashboard/anggota?q=budi&sort=nama&dir=desc",
    );
  });

  it("starts another column ascending, or at firstDir", () => {
    expect(sortHref("/dashboard/anggota", {}, "status", DEFAULT, DEFAULT)).toBe("/dashboard/anggota?sort=status&dir=asc");
    expect(sortHref("/dashboard/anggota", {}, "tanggalMasuk", DEFAULT, DEFAULT, "desc")).toBe(
      "/dashboard/anggota?sort=tanggalMasuk&dir=desc",
    );
  });

  it("omits the default order from the URL", () => {
    expect(sortHref("/dashboard/anggota", { sort: "nama", dir: "desc" }, "nama", { key: "nama", dir: "desc" }, DEFAULT)).toBe(
      "/dashboard/anggota",
    );
  });
});

describe("sortPreserve", () => {
  it("keeps only a non-default order", () => {
    expect(sortPreserve(DEFAULT, DEFAULT)).toEqual({});
    expect(sortPreserve({ key: "status", dir: "desc" }, DEFAULT)).toEqual({ sort: "status", dir: "desc" });
  });
});

describe("compareValues", () => {
  it("orders text and numbers in both directions", () => {
    expect(["b", "a", "c"].sort((x, y) => compareValues(x, y, "asc"))).toEqual(["a", "b", "c"]);
    expect([1, 3, 2].sort((x, y) => compareValues(x, y, "desc"))).toEqual([3, 2, 1]);
  });

  it("puts empty values last either way", () => {
    expect([null, "b", "a"].sort((x, y) => compareValues(x, y, "asc"))).toEqual(["a", "b", null]);
    expect([null, "b", "a"].sort((x, y) => compareValues(x, y, "desc"))).toEqual(["b", "a", null]);
  });
});
