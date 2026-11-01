import { describe, expect, it } from "vitest";
import {
  compareValues,
  DEFAULT_OCCURRENCE_SORT,
  DEFAULT_PARTICIPATION_SORT,
  OCCURRENCE_SORT_KEYS,
  PARTICIPATION_SORT_KEYS,
  parseSort,
  sortHref,
  sortOccurrences,
  sortParticipation,
  sortPreserve,
} from "./sort";

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

const OCC_PARAMS = { sort: "ksort", dir: "kdir", page: "kejadian" } as const;

describe("sort param names", () => {
  it("reads the order from the named params and ignores the default ones", () => {
    const params = { sort: "izin", dir: "desc", ksort: "hadir", kdir: "desc" };
    expect(parseSort(params, OCCURRENCE_SORT_KEYS, DEFAULT_OCCURRENCE_SORT, OCC_PARAMS)).toEqual({ key: "hadir", dir: "desc" });
    expect(parseSort({ sort: "hadir", dir: "desc" }, OCCURRENCE_SORT_KEYS, DEFAULT_OCCURRENCE_SORT, OCC_PARAMS)).toEqual(
      DEFAULT_OCCURRENCE_SORT,
    );
  });

  it("builds links with the named params, drops only its own page and keeps the other table's order", () => {
    const href = sortHref(
      "/dashboard/kegiatan/3",
      { tab: "absensi", kejadian: "2", peserta: "4", psort: "nama", pdir: "asc" },
      "hadir",
      DEFAULT_OCCURRENCE_SORT,
      DEFAULT_OCCURRENCE_SORT,
      "asc",
      OCC_PARAMS,
    );
    expect(href).toBe("/dashboard/kegiatan/3?tab=absensi&peserta=4&psort=nama&pdir=asc&ksort=hadir&kdir=asc");
  });

  it("keeps a non-default order under the named params only", () => {
    expect(sortPreserve({ key: "hadir", dir: "desc" }, DEFAULT_OCCURRENCE_SORT, OCC_PARAMS)).toEqual({ ksort: "hadir", kdir: "desc" });
  });
});

describe("sortParticipation", () => {
  const rows = [
    { memberId: 3, memberName: "Budi", occurrenceCount: 4, hadir: 2, izin: 1, percentHadir: 50 },
    { memberId: 1, memberName: "Ani", occurrenceCount: 4, hadir: 2, izin: 0, percentHadir: 50 },
    { memberId: 2, memberName: "Citra", occurrenceCount: 2, hadir: 2, izin: 0, percentHadir: 100 },
    { memberId: 4, memberName: "Ani", occurrenceCount: 4, hadir: 1, izin: 0, percentHadir: 25 },
  ];
  const ids = (sorted: typeof rows) => sorted.map((r) => r.memberId);

  it("defaults to the highest % hadir first, ties by name then id", () => {
    expect(DEFAULT_PARTICIPATION_SORT).toEqual({ key: "persen", dir: "desc" });
    expect(ids(sortParticipation(rows, DEFAULT_PARTICIPATION_SORT))).toEqual([2, 1, 3, 4]);
  });

  it("orders every listed column in both directions with a stable tie-break", () => {
    expect(PARTICIPATION_SORT_KEYS).toEqual(["nama", "occurrence", "hadir", "izin", "persen"]);
    expect(ids(sortParticipation(rows, { key: "nama", dir: "asc" }))).toEqual([1, 4, 3, 2]);
    expect(ids(sortParticipation(rows, { key: "nama", dir: "desc" }))).toEqual([2, 3, 1, 4]);
    expect(ids(sortParticipation(rows, { key: "hadir", dir: "desc" }))).toEqual([1, 3, 2, 4]);
    expect(ids(sortParticipation(rows, { key: "izin", dir: "desc" }))).toEqual([3, 1, 4, 2]);
    expect(ids(sortParticipation(rows, { key: "occurrence", dir: "asc" }))).toEqual([2, 1, 4, 3]);
  });

  it("does not mutate its input", () => {
    const copy = [...rows];
    sortParticipation(rows, { key: "nama", dir: "asc" });
    expect(rows).toEqual(copy);
  });
});

describe("sortOccurrences", () => {
  const rows = [
    { key: "2026-05-03", effectiveDate: "2026-05-03", expected: 10, hadir: 5, izin: 1, absent: 4, percentHadir: 50 },
    { key: "2026-05-10", effectiveDate: "2026-05-10", expected: 10, hadir: 5, izin: 0, absent: 5, percentHadir: 50 },
    { key: "2026-04-26", effectiveDate: "2026-05-17", expected: 8, hadir: 8, izin: 0, absent: 0, percentHadir: 100 },
  ];
  const keys = (sorted: typeof rows) => sorted.map((r) => r.key);

  it("defaults to the most recent effective date first", () => {
    expect(DEFAULT_OCCURRENCE_SORT).toEqual({ key: "tanggal", dir: "desc" });
    expect(keys(sortOccurrences(rows, DEFAULT_OCCURRENCE_SORT))).toEqual(["2026-04-26", "2026-05-10", "2026-05-03"]);
  });

  it("orders every listed column, ties by newest date then key", () => {
    expect(OCCURRENCE_SORT_KEYS).toEqual(["tanggal", "hadir", "izin", "tidakHadir", "expected", "persen"]);
    expect(keys(sortOccurrences(rows, { key: "persen", dir: "asc" }))).toEqual(["2026-05-10", "2026-05-03", "2026-04-26"]);
    expect(keys(sortOccurrences(rows, { key: "izin", dir: "desc" }))).toEqual(["2026-05-03", "2026-04-26", "2026-05-10"]);
    expect(keys(sortOccurrences(rows, { key: "expected", dir: "desc" }))).toEqual(["2026-05-10", "2026-05-03", "2026-04-26"]);
    expect(keys(sortOccurrences(rows, { key: "tidakHadir", dir: "asc" }))).toEqual(["2026-04-26", "2026-05-03", "2026-05-10"]);
  });
});

describe("hostile sort params", () => {
  it("fall back to the default for keys of the other list", () => {
    expect(parseSort({ sort: "nama" }, OCCURRENCE_SORT_KEYS, DEFAULT_OCCURRENCE_SORT)).toEqual(DEFAULT_OCCURRENCE_SORT);
    expect(parseSort({ sort: "tanggal" }, PARTICIPATION_SORT_KEYS, DEFAULT_PARTICIPATION_SORT)).toEqual(DEFAULT_PARTICIPATION_SORT);
    expect(parseSort({ sort: "__proto__", dir: "desc" }, PARTICIPATION_SORT_KEYS, DEFAULT_PARTICIPATION_SORT)).toEqual(DEFAULT_PARTICIPATION_SORT);
  });
});
