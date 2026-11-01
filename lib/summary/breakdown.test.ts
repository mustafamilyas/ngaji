import { describe, expect, it } from "vitest";
import { createTally, type Breakdown } from "./breakdown";

const facts = (over: Partial<{ sex: string; birthDate: string; maritalStatus: string; workStatus: string }> = {}) => ({
  sex: "L",
  status: "AKTIF",
  maritalStatus: "BELUM_MENIKAH",
  workStatus: "BEKERJA",
  birthDate: "2000-01-01",
  ...over,
});

const bySex: Breakdown = { label: "Jenis kelamin", dimension: { kind: "property", field: "sex" }, tagValues: [] };

describe("createTally", () => {
  it("adds expected / hadir / izin per bucket and derives absent and percent", () => {
    const tally = createTally(bySex, "2026-10-01");
    for (let i = 0; i < 6; i++) tally.add(facts({ sex: "L" }), new Set(), i < 4 ? "HADIR" : i === 4 ? "IZIN" : undefined);
    for (let i = 0; i < 4; i++) tally.add(facts({ sex: "P" }), new Set(), i < 2 ? "HADIR" : undefined);

    const rows = tally.rows();
    const l = rows.find((r) => r.key === "p:L")!;
    expect(l).toMatchObject({ label: "Laki-laki", expected: 6, hadir: 4, izin: 1, absent: 1, percentHadir: 66.7 });
    const p = rows.find((r) => r.key === "p:P")!;
    expect(p).toMatchObject({ expected: 4, hadir: 2, izin: 0, absent: 2, percentHadir: 50 });
  });

  it("drops buckets nobody was expected in, and the rows add up to the totals", () => {
    const tally = createTally(bySex, "2026-10-01");
    tally.add(facts({ sex: "L" }), new Set(), "HADIR");
    tally.add(facts({ sex: "L" }), new Set(), undefined);
    const rows = tally.rows();
    expect(rows.map((r) => r.key)).toEqual(["p:L"]);
    expect(rows.reduce((s, r) => s + r.expected, 0)).toBe(2);
  });

  it("puts members into age brackets by their age on the given date, keeping bracket order", () => {
    const breakdown: Breakdown = {
      label: "Kelompok umur",
      dimension: { kind: "ageBuckets", buckets: [{ label: "anak", min: 0, max: 12 }, { label: "dewasa", min: 13, max: null }] },
      tagValues: [],
    };
    const tally = createTally(breakdown, "2026-10-01");
    tally.add(facts({ birthDate: "1990-05-05" }), new Set(), "HADIR");
    tally.add(facts({ birthDate: "2020-05-05" }), new Set(), undefined);
    expect(tally.rows().map((r) => [r.label, r.expected])).toEqual([["anak", 1], ["dewasa", 1]]);
  });

  it("folds members without a (visible) value of a tag key into Tanpa nilai", () => {
    const breakdown: Breakdown = {
      label: "prioritas",
      dimension: { kind: "tagKey", tagId: 1 },
      tagValues: [{ id: 1, value: "tinggi" }, { id: 2, value: "rendah" }],
    };
    const tally = createTally(breakdown, "2026-10-01");
    tally.add(facts(), new Set([1]), "HADIR");
    tally.add(facts(), new Set([99]), undefined); // a hidden value
    tally.add(facts(), new Set(), "IZIN");
    const rows = tally.rows();
    expect(rows.map((r) => [r.label, r.expected, r.hadir, r.izin])).toEqual([
      ["tinggi", 1, 1, 0],
      ["Tanpa nilai", 2, 0, 1],
    ]);
  });

  it("splits by a simple tag into Punya / Tidak punya", () => {
    const breakdown: Breakdown = { label: "relawan", dimension: { kind: "tag", tagId: 5 }, tagValues: [] };
    const tally = createTally(breakdown, "2026-10-01");
    tally.add(facts(), new Set([5]), "HADIR");
    tally.add(facts(), new Set(), undefined);
    expect(tally.rows().map((r) => [r.label, r.expected])).toEqual([["Punya", 1], ["Tidak punya", 1]]);
  });

  it("has no rows when nobody was expected", () => {
    expect(createTally(bySex, "2026-10-01").rows()).toEqual([]);
  });
});
