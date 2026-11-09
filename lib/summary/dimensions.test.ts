import { describe, expect, it } from "vitest";
import { MARITAL_STATUSES, MEMBER_STATUSES, SEXES, WORK_STATUSES } from "@/lib/validation/enums";
import type { Dimension } from "@/lib/validation/summary";
import { bucketOf, bucketWheres, dimensionBuckets, NONE_LABEL, OTHER_LABEL, type MemberFacts } from "./dimensions";

const TODAY = "2026-10-12";
const member = (overrides: Partial<MemberFacts> = {}): MemberFacts => ({
  sex: "L",
  status: "AKTIF",
  maritalStatus: "MENIKAH",
  workStatus: "BEKERJA",
  birthDate: "1990-05-05",
  ...overrides,
});
const ageBuckets: Dimension = {
  kind: "ageBuckets",
  buckets: [
    { label: "Remaja 13–17", min: 13, max: 17 },
    { label: "Pemuda 18–30", min: 18, max: 30 },
  ],
};
const noTags = new Set<number>();

describe("dimensionBuckets", () => {
  it("lists one bucket per enum value, in enum order, with Indonesian labels", () => {
    const sex = dimensionBuckets({ kind: "property", field: "sex" });
    expect(sex.map((b) => b.key)).toEqual([...SEXES].map((v) => `p:${v}`));
    expect(sex.map((b) => b.label)).toEqual(["Laki-laki", "Perempuan"]);

    expect(dimensionBuckets({ kind: "property", field: "status" }).map((b) => b.key)).toEqual(MEMBER_STATUSES.map((v) => `p:${v}`));
    expect(dimensionBuckets({ kind: "property", field: "maritalStatus" }).map((b) => b.key)).toEqual(MARITAL_STATUSES.map((v) => `p:${v}`));
    const work = dimensionBuckets({ kind: "property", field: "workStatus" });
    expect(work.map((b) => b.key)).toEqual(WORK_STATUSES.map((v) => `p:${v}`));
    expect(work[0].label).toBe("Bekerja");
    expect(work.find((b) => b.key === "p:IBU_RUMAH_TANGGA")?.label).toBe("Ibu Rumah Tangga");
  });

  it("lists age buckets in the given order followed by Lainnya", () => {
    expect(dimensionBuckets(ageBuckets)).toEqual([
      { key: "a:0", label: "Remaja 13–17" },
      { key: "a:1", label: "Pemuda 18–30" },
      { key: "a:other", label: OTHER_LABEL },
    ]);
  });

  it("lists Punya / Tidak punya for a simple tag", () => {
    expect(dimensionBuckets({ kind: "tag", tagId: 4 })).toEqual([
      { key: "tag:yes", label: "Punya" },
      { key: "tag:no", label: "Tidak punya" },
    ]);
  });

  it("lists tag-key values ordered by value, then Tanpa nilai", () => {
    const values = [{ id: 9, value: "tinggi" }, { id: 3, value: "rendah" }];
    expect(dimensionBuckets({ kind: "tagKey", tagId: 9 }, values)).toEqual([
      { key: "t:3", label: "rendah" },
      { key: "t:9", label: "tinggi" },
      { key: "t:none", label: NONE_LABEL },
    ]);
  });

  it("has only Tanpa nilai for a key without visible values", () => {
    expect(dimensionBuckets({ kind: "tagKey", tagId: 9 }, [])).toEqual([{ key: "t:none", label: NONE_LABEL }]);
  });
});

describe("bucketOf", () => {
  it("puts a member in the bucket of its property value", () => {
    expect(bucketOf({ kind: "property", field: "sex" }, member({ sex: "P" }), TODAY, noTags)).toBe("p:P");
    expect(bucketOf({ kind: "property", field: "workStatus" }, member({ workStatus: "MAHASISWA" }), TODAY, noTags)).toBe("p:MAHASISWA");
  });

  it("puts a member in an age bucket, boundaries inclusive", () => {
    expect(bucketOf(ageBuckets, member({ birthDate: "2009-10-12" }), TODAY, noTags)).toBe("a:0"); // turns 17 today
    expect(bucketOf(ageBuckets, member({ birthDate: "2008-10-12" }), TODAY, noTags)).toBe("a:1"); // turns 18 today
    expect(bucketOf(ageBuckets, member({ birthDate: "1996-10-13" }), TODAY, noTags)).toBe("a:1"); // 30, birthday tomorrow
    expect(bucketOf(ageBuckets, member({ birthDate: "1995-10-12" }), TODAY, noTags)).toBe("a:other"); // 31
  });

  it("puts a member outside every bucket in Lainnya", () => {
    expect(bucketOf(ageBuckets, member({ birthDate: "1986-01-01" }), TODAY, noTags)).toBe("a:other");
    expect(bucketOf(ageBuckets, member({ birthDate: "2020-01-01" }), TODAY, noTags)).toBe("a:other");
  });

  it("treats an open-ended bucket as unbounded above", () => {
    const lansia: Dimension = { kind: "ageBuckets", buckets: [{ label: "Lansia", min: 60, max: null }] };
    expect(bucketOf(lansia, member({ birthDate: "1900-01-01" }), TODAY, noTags)).toBe("a:0");
  });

  it("handles 29 Feb birthdays on and around 28 Feb / 1 Mar", () => {
    const dim: Dimension = { kind: "ageBuckets", buckets: [{ label: "Satu", min: 1, max: 1 }] };
    const leapBaby = member({ birthDate: "2024-02-29" });
    expect(bucketOf(dim, leapBaby, "2025-02-28", noTags)).toBe("a:other"); // still 0
    expect(bucketOf(dim, leapBaby, "2025-03-01", noTags)).toBe("a:0"); // 1
  });

  it("splits a simple tag into Punya and Tidak punya", () => {
    const dim: Dimension = { kind: "tag", tagId: 4 };
    expect(bucketOf(dim, member(), TODAY, new Set([4, 8]))).toBe("tag:yes");
    expect(bucketOf(dim, member(), TODAY, new Set([8]))).toBe("tag:no");
  });

  it("uses the member's value of the key, else Tanpa nilai", () => {
    const dim: Dimension = { kind: "tagKey", tagId: 9 };
    const values = [{ id: 3, value: "rendah" }, { id: 9, value: "tinggi" }];
    expect(bucketOf(dim, member(), TODAY, new Set([9, 100]), values)).toBe("t:9");
    expect(bucketOf(dim, member(), TODAY, new Set([100]), values)).toBe("t:none");
  });

  it("counts a member whose only value is hidden or deleted as Tanpa nilai", () => {
    const dim: Dimension = { kind: "tagKey", tagId: 9 };
    // tag 5 was a value of the key but is no longer among the visible values
    expect(bucketOf(dim, member(), TODAY, new Set([5]), [{ id: 9, value: "tinggi" }])).toBe("t:none");
  });
});

describe("bucketWheres", () => {
  it("returns one where per enum value", () => {
    const wheres = bucketWheres({ kind: "property", field: "sex" }, TODAY);
    expect(wheres).toEqual([
      { key: "p:L", label: "Laki-laki", where: { sex: "L" } },
      { key: "p:P", label: "Perempuan", where: { sex: "P" } },
    ]);
  });

  it("returns birth-date bounds per age bucket and the complement for Lainnya", () => {
    const wheres = bucketWheres(ageBuckets, TODAY);
    expect(wheres.map((w) => w.key)).toEqual(["a:0", "a:1", "a:other"]);
    expect(wheres[0].where).toEqual({ birthDate: { gt: "2008-10-12", lte: "2013-10-12" } });
    expect(wheres[1].where).toEqual({ birthDate: { gt: "1995-10-12", lte: "2008-10-12" } });
    expect(wheres[2].where).toEqual({ NOT: { OR: [wheres[0].where, wheres[1].where] } });
  });

  it("matches the in-memory bucket for every birth date around the edges", () => {
    const wheres = bucketWheres(ageBuckets, TODAY);
    for (const birthDate of ["2013-10-12", "2013-10-13", "2009-10-12", "2008-10-12", "1996-10-13", "1995-10-12", "1995-10-13", "1990-01-01"]) {
      const inMemory = bucketOf(ageBuckets, member({ birthDate }), TODAY, noTags);
      const where = wheres.find((w) => w.key === inMemory)!.where as { birthDate?: { gt?: string; lte?: string }; NOT?: unknown };
      if (where.birthDate) {
        expect(birthDate > (where.birthDate.gt ?? ""), birthDate).toBe(true);
        expect(birthDate <= (where.birthDate.lte ?? "9999"), birthDate).toBe(true);
      }
    }
  });

  it("returns some / none link filters for a simple tag", () => {
    expect(bucketWheres({ kind: "tag", tagId: 4 }, TODAY)).toEqual([
      { key: "tag:yes", label: "Punya", where: { tags: { some: { tagId: 4 } } } },
      { key: "tag:no", label: "Tidak punya", where: { tags: { none: { tagId: 4 } } } },
    ]);
  });
});
