import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EMBEDDED_PAGE_SIZE, SUMMARY_MAX_BARS } from "@/lib/constants";
import { db } from "@/lib/db";
import { buildPageFixture, sessionFor, type PageFixture } from "@/lib/test/fixtures";
import { emptyDefinition, type Definition, type Rule } from "@/lib/validation/member-view";
import type { Dimension } from "@/lib/validation/summary";
import { computeSummaries } from "./summaries";

const TODAY = "2026-10-12";

let fx: PageFixture;
let leafSession: ReturnType<typeof sessionFor>;
let branchSession: ReturnType<typeof sessionFor>;
let rootSession: ReturnType<typeof sessionFor>;
let keyTagId: number;
let siblingTagId: number;
const extraLeafIds: number[] = [];

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

const withSummaries = (dimensions: Dimension[], extra: Partial<Definition> = {}): Definition => ({
  ...emptyDefinition(),
  summaries: dimensions.map((dimension) => ({ dimension })),
  ...extra,
});
const rules = (...r: Rule[]): Definition["filter"] => ({ op: "AND", groups: [{ op: "AND", rules: r }] });

async function cardsOf(session: typeof leafSession, definition: Definition, pages: Record<number, number> = {}) {
  return computeSummaries(session, definition, { today: TODAY, pages });
}

describe("computeSummaries", () => {
  beforeAll(async () => {
    fx = await buildPageFixture("view-summaries");
    leafSession = sessionFor(fx.actorId, "ADMIN", fx.leaf);
    branchSession = sessionFor(fx.actorId, "ADMIN", fx.branch);
    rootSession = sessionFor(fx.actorId, "ADMIN", fx.root);

    // leaf: fixture member (L, 26) + P 15 + L 16 + PINDAH 66; otherLeaf: 1 P 40.
    await makeMember(fx.leaf.id, "Remaja Putri", { birthDate: "2011-03-01", sex: "P" });
    await makeMember(fx.leaf.id, "Remaja Putra", { birthDate: "2010-01-01" });
    await makeMember(fx.leaf.id, "Lansia", { birthDate: "1960-01-01", status: "PINDAH" });
    await makeMember(fx.leaf.id, "Sudah Dihapus", { deletedAt: new Date() });
    await makeMember(fx.otherLeaf.id, "Kelompok Lain", { birthDate: "1986-01-01", sex: "P" });

    const tinggi = await db.tag.create({ data: { groupId: fx.branch.id, key: "prioritas", value: "tinggi", color: "slate", createdById: fx.actorId } });
    keyTagId = tinggi.id;
    const sibling = await db.tag.create({ data: { groupId: fx.otherLeaf.id, key: "rahasia", value: "x", color: "slate", createdById: fx.actorId } });
    siblingTagId = sibling.id;
    const putri = await db.member.findFirstOrThrow({ where: { name: "Remaja Putri", groupId: fx.leaf.id } });
    await db.memberTag.create({ data: { memberId: putri.id, tagId: tinggi.id, createdById: fx.actorId } });

    // 14 more leaves with one member each under the branch, for pagination.
    for (let i = 0; i < 14; i++) {
      const row = await db.group.create({
        data: { organizationId: fx.organizationId, parentId: fx.branch.id, depth: 2, name: `Kelompok ${String(i).padStart(2, "0")}`, path: "" },
      });
      await db.group.update({ where: { id: row.id }, data: { path: `${fx.branch.path}${row.id}/` } });
      extraLeafIds.push(row.id);
      await makeMember(row.id, `Anggota ${i}`);
    }
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns no cards for a definition without summaries", async () => {
    const result = await cardsOf(leafSession, emptyDefinition());
    expect(result).toMatchObject({ cards: [], dropped: false });
  });

  it("counts every non-empty bucket with its share, adding up to the population", async () => {
    const { cards } = await cardsOf(leafSession, withSummaries([{ kind: "property", field: "sex" }]));
    expect(cards).toHaveLength(1);
    expect(cards[0].total).toBe(4);
    expect(cards[0].chart.map((b) => [b.label, b.count, b.percent])).toEqual([
      ["Laki-laki", 3, 75],
      ["Perempuan", 1, 25],
    ]);
  });

  it("hides empty buckets", async () => {
    const { cards } = await cardsOf(leafSession, withSummaries([{ kind: "property", field: "status" }]));
    expect(cards[0].chart.map((b) => b.label)).toEqual(["Aktif", "Pindah"]);
  });

  it("follows the view filter", async () => {
    const definition = withSummaries([{ kind: "property", field: "sex" }], {
      filter: rules({ field: "status", operator: "isAnyOf", value: ["AKTIF"] }),
    });
    const { cards } = await cardsOf(leafSession, definition);
    expect(cards[0].total).toBe(3);
  });

  it("never counts members outside the viewer's scope or deleted members", async () => {
    const leaf = await cardsOf(leafSession, withSummaries([{ kind: "property", field: "sex" }]));
    const branch = await cardsOf(branchSession, withSummaries([{ kind: "property", field: "sex" }]));
    expect(leaf.cards[0].total).toBe(4);
    expect(branch.cards[0].total).toBe(4 + 1 + 14);
  });

  it("puts members outside every age bucket in Lainnya", async () => {
    const dimension: Dimension = {
      kind: "ageBuckets",
      buckets: [{ label: "Remaja 13–17", min: 13, max: 17 }, { label: "Pemuda 18–30", min: 18, max: 30 }],
    };
    const { cards } = await cardsOf(leafSession, withSummaries([dimension]));
    expect(cards[0].chart.map((b) => [b.label, b.count])).toEqual([
      ["Remaja 13–17", 2],
      ["Pemuda 18–30", 1],
      ["Lainnya", 1],
    ]);
  });

  it("counts by tag key with Tanpa nilai", async () => {
    const { cards } = await cardsOf(leafSession, withSummaries([{ kind: "tagKey", tagId: keyTagId }]));
    expect(cards[0].title).toBe("prioritas");
    expect(cards[0].chart.map((b) => [b.label, b.count])).toEqual([
      ["tinggi", 1],
      ["Tanpa nilai", 3],
    ]);
  });

  it("drops a summary on a tag the viewer cannot see and flags it", async () => {
    const { cards, dropped } = await cardsOf(
      leafSession,
      withSummaries([{ kind: "tagKey", tagId: siblingTagId }, { kind: "property", field: "sex" }]),
    );
    expect(dropped).toBe(true);
    expect(cards.map((c) => c.dimension.kind)).toEqual(["property"]);
  });

  it("keeps saved order and gives each card its position", async () => {
    const { cards } = await cardsOf(
      leafSession,
      withSummaries([{ kind: "property", field: "status" }, { kind: "property", field: "sex" }]),
    );
    expect(cards.map((c) => [c.index, c.dimension.kind === "property" ? c.dimension.field : ""])).toEqual([
      [0, "status"],
      [1, "sex"],
    ]);
  });

  describe("org level", () => {
    it("rolls up to the chosen level by name", async () => {
      const { cards } = await cardsOf(rootSession, withSummaries([{ kind: "groupLevel", depth: 1 }]));
      expect(cards[0].chart.map((b) => [b.label, b.count])).toEqual([["Branch", 4 + 1 + 14]]);
      expect(cards[0].title).toBe("Branch");
    });

    it("flags a level above the viewer's own group instead of counting", async () => {
      const { cards } = await cardsOf(leafSession, withSummaries([{ kind: "groupLevel", depth: 1 }]));
      expect(cards[0].levelInvalid).toBe(true);
      expect(cards[0].chart).toEqual([]);
    });

    it("draws the first SUMMARY_MAX_BARS buckets and pages the full table", async () => {
      const { cards } = await cardsOf(branchSession, withSummaries([{ kind: "groupLevel", depth: 2 }]));
      const card = cards[0];
      expect(card.bucketCount).toBe(16);
      expect(card.chart).toHaveLength(SUMMARY_MAX_BARS);
      expect(card.table).toMatchObject({ page: 1, pageSize: EMBEDDED_PAGE_SIZE, total: 16 });
      expect(card.table?.items).toHaveLength(EMBEDDED_PAGE_SIZE);
    });

    it("pages one card without touching the others and clamps a stale page", async () => {
      const definition = withSummaries([{ kind: "groupLevel", depth: 2 }, { kind: "groupLevel", depth: 2 }]);
      const { cards } = await cardsOf(branchSession, definition, { 0: 2, 1: 99 });
      expect(cards[0].table?.page).toBe(2);
      expect(cards[0].table?.items).toHaveLength(6);
      expect(cards[1].table?.page).toBe(2);
    });

    it("has no table when everything fits in the chart", async () => {
      const { cards } = await cardsOf(leafSession, withSummaries([{ kind: "property", field: "sex" }]));
      expect(cards[0].table).toBeNull();
      expect(cards[0].bucketCount).toBe(2);
    });
  });

  it("is independent of sort, columns and grouping", async () => {
    const plain = await cardsOf(leafSession, withSummaries([{ kind: "property", field: "sex" }]));
    const other = await cardsOf(
      leafSession,
      withSummaries([{ kind: "property", field: "sex" }], {
        sort: { field: "birthDate", dir: "desc" },
        groupBy: { kind: "property", field: "status" },
        columns: ["whatsapp"],
      }),
    );
    expect(other.cards[0].chart).toEqual(plain.cards[0].chart);
  });
});
