import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { buildPageFixture, type PageFixture } from "@/lib/test/fixtures";
import { countByTag, countByTagKey } from "./count";

const TODAY = "2026-10-12";

let fx: PageFixture;
let population: { deletedAt: null; group: { path: { startsWith: string } } };
let tinggi: { id: number; value: string };
let rendah: { id: number; value: string };
let sedangId: number;
let simpleTagId: number;

async function makeMember(groupId: number, name: string, overrides: Record<string, unknown> = {}) {
  return db.member.create({
    data: {
      groupId,
      name,
      birthPlace: "Jakarta",
      birthDate: "2000-01-01",
      sex: "L",
      address: "Jl. Rahasia 1",
      phone: "081200009999",
      maritalStatus: "BELUM_MENIKAH",
      workStatus: "BEKERJA",
      joinedAt: "2020-01-01",
      createdById: fx.actorId,
      ...overrides,
    },
  });
}

async function makeTag(key: string, value: string | null, overrides: Record<string, unknown> = {}) {
  return db.tag.create({
    data: { groupId: fx.branch.id, key, value, color: "slate", createdById: fx.actorId, ...overrides },
  });
}

const link = (memberId: number, tagId: number) =>
  db.memberTag.create({ data: { memberId, tagId, createdById: fx.actorId } });

describe("tag counting", () => {
  beforeAll(async () => {
    fx = await buildPageFixture("summary-count");
    population = { deletedAt: null, group: { path: { startsWith: fx.leaf.path } } };

    const tinggiTag = await makeTag("prioritas", "tinggi");
    const rendahTag = await makeTag("prioritas", "rendah");
    const sedangTag = await makeTag("prioritas", "sedang");
    const simpleTag = await makeTag("relawan", null);
    tinggi = { id: tinggiTag.id, value: "tinggi" };
    rendah = { id: rendahTag.id, value: "rendah" };
    sedangId = sedangTag.id;
    simpleTagId = simpleTag.id;

    // Leaf population = fixture member + five: 6 members.
    const m1 = await makeMember(fx.leaf.id, "Tinggi Satu");
    const m2 = await makeMember(fx.leaf.id, "Tinggi Dua");
    const m3 = await makeMember(fx.leaf.id, "Rendah Satu");
    const m4 = await makeMember(fx.leaf.id, "Sedang Terhapus");
    await makeMember(fx.leaf.id, "Tanpa Tag");
    await link(m1.id, tinggiTag.id);
    await link(m2.id, tinggiTag.id);
    await link(m3.id, rendahTag.id);
    await link(m4.id, sedangTag.id);
    await db.tag.update({ where: { id: sedangTag.id }, data: { deletedAt: new Date() } });
    await link(m1.id, simpleTag.id);
    await link(fx.memberId, simpleTag.id);

    // Never counted for the leaf population.
    const elsewhere = await makeMember(fx.otherLeaf.id, "Kelompok Lain");
    await link(elsewhere.id, tinggiTag.id);
    const deleted = await makeMember(fx.leaf.id, "Sudah Dihapus", { deletedAt: new Date() });
    await link(deleted.id, tinggiTag.id);
    await link(deleted.id, simpleTag.id);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("countByTagKey", () => {
    it("counts one bucket per value ordered by value, then Tanpa nilai", async () => {
      const buckets = await countByTagKey(population, [tinggi, rendah]);
      expect(buckets.map((b) => [b.key, b.label, b.count])).toEqual([
        [`t:${rendah.id}`, "rendah", 1],
        [`t:${tinggi.id}`, "tinggi", 2],
        ["t:none", "Tanpa nilai", 3],
      ]);
    });

    it("adds up to the population total", async () => {
      const buckets = await countByTagKey(population, [tinggi, rendah]);
      const total = await db.member.count({ where: population });
      expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(total);
    });

    it("folds members linked only to a deleted value into Tanpa nilai", async () => {
      const buckets = await countByTagKey(population, [tinggi, rendah]);
      expect(buckets.map((b) => b.key)).not.toContain(`t:${sedangId}`);
      expect(buckets.find((b) => b.key === "t:none")?.count).toBe(3);
    });

    it("folds values missing from the visible list into Tanpa nilai", async () => {
      const buckets = await countByTagKey(population, [rendah]);
      expect(buckets.map((b) => [b.key, b.count])).toEqual([
        [`t:${rendah.id}`, 1],
        ["t:none", 5],
      ]);
    });

    it("puts everyone in Tanpa nilai when no value is visible", async () => {
      const buckets = await countByTagKey(population, []);
      expect(buckets.map((b) => [b.key, b.count])).toEqual([["t:none", 6]]);
    });

    it("never counts members outside the population", async () => {
      const buckets = await countByTagKey({ deletedAt: null, groupId: fx.otherLeaf.id }, [tinggi, rendah]);
      expect(buckets.map((b) => [b.key, b.count])).toEqual([
        [`t:${rendah.id}`, 0],
        [`t:${tinggi.id}`, 1],
        ["t:none", 0],
      ]);
    });

    it("gives each bucket a where that selects the same members", async () => {
      const buckets = await countByTagKey(population, [tinggi, rendah]);
      for (const bucket of buckets) {
        const n = await db.member.count({ where: { AND: [population, bucket.where] } });
        expect(n).toBe(bucket.count);
      }
    });
  });

  describe("countByTag", () => {
    it("counts Punya and Tidak punya, adding up to the total", async () => {
      const buckets = await countByTag(population, { kind: "tag", tagId: simpleTagId }, TODAY);
      expect(buckets.map((b) => [b.key, b.label, b.count])).toEqual([
        ["tag:yes", "Punya", 2],
        ["tag:no", "Tidak punya", 4],
      ]);
    });

    it("ignores links of deleted and out-of-scope members", async () => {
      const buckets = await countByTag({ deletedAt: null, groupId: fx.otherLeaf.id }, { kind: "tag", tagId: simpleTagId }, TODAY);
      expect(buckets.map((b) => b.count)).toEqual([0, 1]);
    });
  });
});
