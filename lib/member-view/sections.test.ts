import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { VIEW_EXPANDED_SECTIONS, VIEW_SECTION_PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { buildPageFixture, sessionFor, type PageFixture } from "@/lib/test/fixtures";
import { emptyDefinition, type Definition, type GroupBy } from "@/lib/validation/member-view";
import { listViewSections, loadSectionMembers } from "./sections";

const TODAY = "2026-10-12";

let fx: PageFixture;
let leafSession: ReturnType<typeof sessionFor>;
let branchSession: ReturnType<typeof sessionFor>;
let rootSession: ReturnType<typeof sessionFor>;
let outsideGroupId: number;

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

const grouped = (groupBy: GroupBy | undefined, extra: Partial<Definition> = {}): Definition => ({
  ...emptyDefinition(),
  groupBy,
  ...extra,
});

async function sectionsOf(session: typeof leafSession, groupBy: GroupBy, extra: Partial<Definition> = {}) {
  const result = await listViewSections(session, grouped(groupBy, extra), { today: TODAY });
  if (!result.grouped) throw new Error("expected a grouped result");
  return result;
}

describe("listViewSections", () => {
  beforeAll(async () => {
    fx = await buildPageFixture("view-sections");
    leafSession = sessionFor(fx.actorId, "ADMIN", fx.leaf);
    branchSession = sessionFor(fx.actorId, "ADMIN", fx.branch);
    rootSession = sessionFor(fx.actorId, "ADMIN", fx.root);

    // A second branch with its own leaf, so roll-up at the branch level has two sections.
    const branchB = await db.group.create({
      data: { organizationId: fx.organizationId, parentId: fx.root.id, depth: 1, name: "Cabang B", path: "" },
    });
    const branchBPath = `${fx.root.path}${branchB.id}/`;
    await db.group.update({ where: { id: branchB.id }, data: { path: branchBPath } });
    const leafB = await db.group.create({
      data: { organizationId: fx.organizationId, parentId: branchB.id, depth: 2, name: "Leaf B", path: "" },
    });
    await db.group.update({ where: { id: leafB.id }, data: { path: `${branchBPath}${leafB.id}/` } });
    outsideGroupId = leafB.id;

    // Fixture member "Anggota Uji": L, born 2000-01-01 (26), AKTIF, in `leaf`.
    await makeMember(fx.leaf.id, "Remaja Putri", { birthDate: "2011-03-01", sex: "P" }); // 15
    await makeMember(fx.leaf.id, "Remaja Putra", { birthDate: "2010-01-01" }); // 16
    await makeMember(fx.leaf.id, "Pemuda", { birthDate: "2001-06-01" }); // 25
    await makeMember(fx.leaf.id, "Lansia", { birthDate: "1960-01-01", status: "PINDAH" }); // 66
    await makeMember(fx.leaf.id, "Sudah Dihapus", { birthDate: "2011-01-01", deletedAt: new Date() });
    await makeMember(fx.otherLeaf.id, "Kelompok Lain", { birthDate: "2011-01-01" }); // 15
    await makeMember(leafB.id, "Cabang Lain", { birthDate: "2011-01-01" }); // 15

    // Many members in one section, to exercise paging.
    for (let i = 0; i < VIEW_SECTION_PAGE_SIZE + 5; i++) {
      await makeMember(fx.otherLeaf.id, `Banyak ${String(i).padStart(3, "0")}`, { status: "KELUAR" });
    }
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("ungrouped definitions", () => {
    it("reports grouped = false without a groupBy", async () => {
      const result = await listViewSections(leafSession, emptyDefinition(), { today: TODAY });
      expect(result.grouped).toBe(false);
    });
  });

  describe("group by property", () => {
    it("makes one section per value present, in enum order, with counts", async () => {
      const { sections } = await sectionsOf(leafSession, { kind: "property", field: "status" });
      expect(sections.map((s) => [s.key, s.label, s.count])).toEqual([
        ["p:AKTIF", "Aktif", 4],
        ["p:PINDAH", "Pindah", 1],
      ]);
    });

    it("hides empty sections", async () => {
      const { sections } = await sectionsOf(leafSession, { kind: "property", field: "status" });
      expect(sections.map((s) => s.key)).not.toContain("p:KELUAR");
    });

    it("respects the filter and excludes soft-deleted members from counts", async () => {
      const { sections } = await sectionsOf(
        leafSession,
        { kind: "property", field: "sex" },
        { filter: { op: "AND", groups: [{ op: "AND", rules: [{ field: "age", operator: "lte", value: 16 }] }] } },
      );
      expect(sections.map((s) => [s.key, s.count])).toEqual([
        ["p:L", 1],
        ["p:P", 1],
      ]);
    });

    it("labels sex values in Indonesian", async () => {
      const { sections } = await sectionsOf(leafSession, { kind: "property", field: "sex" });
      expect(sections.map((s) => s.label)).toEqual(["Laki-laki", "Perempuan"]);
    });
  });

  describe("group by age buckets", () => {
    const buckets = [
      { label: "Remaja", min: 13, max: 17 },
      { label: "Pemuda", min: 18, max: 30 },
    ];

    it("orders sections by bucket and puts the rest in Lainnya", async () => {
      const { sections } = await sectionsOf(leafSession, { kind: "ageBuckets", buckets });
      expect(sections.map((s) => [s.key, s.label, s.count])).toEqual([
        ["a:0", "Remaja", 2],
        ["a:1", "Pemuda", 2],
        ["a:other", "Lainnya", 1],
      ]);
    });

    it("hides empty buckets and the Lainnya section when nothing is left over", async () => {
      const { sections } = await sectionsOf(leafSession, {
        kind: "ageBuckets",
        buckets: [
          { label: "Anak", min: 0, max: 5 },
          { label: "Semua", min: 6, max: null },
        ],
      });
      expect(sections.map((s) => s.key)).toEqual(["a:1"]);
    });

    it("includes the day-of-birthday boundary as the age on the viewing date", async () => {
      await makeMember(fx.leaf.id, "Tepat Delapan Belas", { birthDate: "2008-10-12" }); // 18 today
      await makeMember(fx.leaf.id, "Kurang Sehari", { birthDate: "2008-10-13" }); // 17 today
      const { sections } = await sectionsOf(leafSession, { kind: "ageBuckets", buckets });
      expect(sections.find((s) => s.key === "a:0")?.count).toBe(3);
      expect(sections.find((s) => s.key === "a:1")?.count).toBe(3);
    });
  });

  describe("group by org level", () => {
    it("rolls leaf members up to the ancestor at that level", async () => {
      const { sections } = await sectionsOf(rootSession, { kind: "groupLevel", depth: 1 });
      const byLabel = Object.fromEntries(sections.map((s) => [s.label, s.count]));
      expect(byLabel["Branch"]).toBeGreaterThan(VIEW_SECTION_PAGE_SIZE);
      expect(byLabel["Cabang B"]).toBe(1);
      expect(sections.map((s) => s.label)).toEqual(["Branch", "Cabang B"]); // by group name
    });

    it("makes one section per leaf group at the leaf level, hiding empty groups", async () => {
      const { sections } = await sectionsOf(branchSession, { kind: "groupLevel", depth: 2 });
      expect(sections.map((s) => s.label)).toEqual(["Leaf", "Other Leaf"]);
    });

    it("groups at the viewer's own level into a single section", async () => {
      const { sections } = await sectionsOf(branchSession, { kind: "groupLevel", depth: 1 });
      expect(sections.map((s) => s.label)).toEqual(["Branch"]);
    });

    it("does not leak members of groups outside the viewer's scope", async () => {
      const { sections } = await sectionsOf(branchSession, { kind: "groupLevel", depth: 2 });
      expect(sections.map((s) => s.label)).not.toContain("Leaf B");
    });

    it("falls back to ungrouped with levelInvalid when the level is above the viewer's group", async () => {
      const result = await listViewSections(leafSession, grouped({ kind: "groupLevel", depth: 1 }), { today: TODAY });
      expect(result).toMatchObject({ grouped: false, levelInvalid: true });
    });

    it("returns no sections for a level below the leaf level", async () => {
      const { sections } = await sectionsOf(branchSession, { kind: "groupLevel", depth: 5 });
      expect(sections).toEqual([]);
    });
  });

  describe("initial member loading", () => {
    it("loads the first page for the first VIEW_EXPANDED_SECTIONS sections only", async () => {
      const { sections } = await sectionsOf(branchSession, { kind: "property", field: "status" });
      const expanded = sections.slice(0, VIEW_EXPANDED_SECTIONS);
      for (const s of expanded) {
        expect(s.expanded).toBe(true);
        expect(s.loaded).toBe(true);
        expect(s.members.length).toBe(Math.min(s.count, VIEW_SECTION_PAGE_SIZE));
      }
    });

    it("returns counts only for collapsed sections", async () => {
      // One bucket per age present in the fixture (15, 16, 25, 26, 66) plus "Lainnya" (17, 18) → 6 non-empty sections.
      const buckets = [15, 16, 25, 26, 66].map((age) => ({ label: `U${age}`, min: age, max: age }));
      const { sections } = await sectionsOf(leafSession, { kind: "ageBuckets", buckets });
      expect(sections.length).toBeGreaterThan(VIEW_EXPANDED_SECTIONS);
      const collapsed = sections.slice(VIEW_EXPANDED_SECTIONS);
      expect(collapsed.length).toBeGreaterThan(0);
      for (const s of collapsed) {
        expect(s).toMatchObject({ expanded: false, loaded: false, members: [] });
        expect(s.count).toBeGreaterThan(0);
      }
    });

    it("flags hasMore when a section exceeds one page", async () => {
      const { sections } = await sectionsOf(branchSession, { kind: "property", field: "status" });
      const keluar = sections.find((s) => s.key === "p:KELUAR")!;
      expect(keluar.count).toBe(VIEW_SECTION_PAGE_SIZE + 5);
      expect(keluar.members).toHaveLength(VIEW_SECTION_PAGE_SIZE);
      expect(keluar.hasMore).toBe(true);
    });

    it("applies the view's sort within a section and selects only chosen columns", async () => {
      const { sections } = await sectionsOf(
        leafSession,
        { kind: "property", field: "status" },
        { sort: { field: "age", dir: "desc" }, columns: ["jenisKelamin"] },
      );
      const aktif = sections.find((s) => s.key === "p:AKTIF")!;
      expect(aktif.members[0]).toMatchObject({ name: "Anggota Uji" });
      const row = aktif.members[0] as Record<string, unknown>;
      for (const hidden of ["phone", "address", "email", "birthDate"]) expect(row).not.toHaveProperty(hidden);
    });
  });

  describe("loadSectionMembers", () => {
    const groupBy: GroupBy = { kind: "property", field: "status" };

    it("returns the next page of one section only", async () => {
      const first = await loadSectionMembers(branchSession, grouped(groupBy), "p:KELUAR", 0, { today: TODAY });
      const next = await loadSectionMembers(branchSession, grouped(groupBy), "p:KELUAR", VIEW_SECTION_PAGE_SIZE, {
        today: TODAY,
      });
      expect(first?.members).toHaveLength(VIEW_SECTION_PAGE_SIZE);
      expect(first?.hasMore).toBe(true);
      expect(next?.members).toHaveLength(5);
      expect(next?.hasMore).toBe(false);
      const firstNames = new Set(first!.members.map((m) => m.name));
      expect(next!.members.every((m) => !firstNames.has(m.name))).toBe(true);
    });

    it("works for age bucket and org-level keys", async () => {
      const ageResult = await loadSectionMembers(
        leafSession,
        grouped({ kind: "ageBuckets", buckets: [{ label: "Remaja", min: 13, max: 17 }] }),
        "a:other",
        0,
        { today: TODAY },
      );
      expect(ageResult?.members.map((m) => m.name).sort()).toEqual(["Anggota Uji", "Lansia", "Pemuda", "Tepat Delapan Belas"].sort());

      const orgResult = await loadSectionMembers(
        rootSession,
        grouped({ kind: "groupLevel", depth: 1 }),
        `g:${outsideGroupId}`,
        0,
        { today: TODAY },
      );
      expect(orgResult).toBeNull(); // a leaf id is not a section at depth 1
    });

    it("rejects unknown, empty or malformed keys", async () => {
      for (const key of ["p:HILANG", "a:7", "x:1", "p:", "g:abc", "", "g:-1"]) {
        expect(await loadSectionMembers(branchSession, grouped(groupBy), key, 0, { today: TODAY })).toBeNull();
      }
    });

    it("rejects an org-level key outside the viewer's scope", async () => {
      const branchB = await db.group.findFirstOrThrow({ where: { name: "Cabang B", organizationId: fx.organizationId } });
      const result = await loadSectionMembers(
        branchSession,
        grouped({ kind: "groupLevel", depth: 1 }),
        `g:${branchB.id}`,
        0,
        { today: TODAY },
      );
      expect(result).toBeNull();
    });

    it("returns null when the definition has no grouping", async () => {
      expect(await loadSectionMembers(branchSession, emptyDefinition(), "p:AKTIF", 0, { today: TODAY })).toBeNull();
    });

    it("treats a negative or fractional offset as 0", async () => {
      const result = await loadSectionMembers(branchSession, grouped(groupBy), "p:KELUAR", -10.5, { today: TODAY });
      expect(result?.members).toHaveLength(VIEW_SECTION_PAGE_SIZE);
    });
  });
});
