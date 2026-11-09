import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { buildPageFixture, sessionFor, type PageFixture } from "@/lib/test/fixtures";
import { emptyDefinition, type Definition, type Rule } from "@/lib/validation/member-view";
import { listViewMembers } from "./results";

const TODAY = "2026-10-12";

let fx: PageFixture;
let leafSession: ReturnType<typeof sessionFor>;
let branchSession: ReturnType<typeof sessionFor>;

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

function definitionWith(groups: { op: "AND" | "OR"; rules: Rule[] }[], op: "AND" | "OR" = "AND"): Definition {
  return { ...emptyDefinition(), filter: { op, groups } };
}

const names = (result: { members: { name: string }[] }) => result.members.map((m) => m.name);

describe("listViewMembers", () => {
  beforeAll(async () => {
    fx = await buildPageFixture("view-results");
    leafSession = sessionFor(fx.actorId, "ADMIN", fx.leaf);
    branchSession = sessionFor(fx.actorId, "ADMIN", fx.branch);

    // The fixture member ("Anggota Uji", born 2000-01-01) stays in `leaf`.
    await makeMember(fx.leaf.id, "Sehari Sebelum", { birthDate: "2009-10-13" }); // turns 17 tomorrow → 16
    await makeMember(fx.leaf.id, "Ulang Tahun Hari Ini", { birthDate: "2009-10-12" }); // 17 today
    await makeMember(fx.leaf.id, "Remaja Putri", { birthDate: "2011-03-01", sex: "P" }); // 15
    await makeMember(fx.leaf.id, "Pindah Putra", { birthDate: "1990-05-05", status: "PINDAH" });
    await makeMember(fx.leaf.id, "Sudah Dihapus", { birthDate: "2009-10-12", deletedAt: new Date() });
    await makeMember(fx.otherLeaf.id, "Kelompok Lain", { birthDate: "2009-10-12" });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("Results are scope-limited", () => {
    it("lists only members in the viewer's scope for an empty filter", async () => {
      const result = await listViewMembers(leafSession, emptyDefinition(), { today: TODAY });
      expect(names(result)).not.toContain("Kelompok Lain");
      expect(names(result)).toContain("Anggota Uji");
      expect(names(result)).toContain("Sehari Sebelum");
      expect(result.total).toBe(result.members.length);
    });

    it("includes sibling groups for a viewer higher in the tree", async () => {
      const result = await listViewMembers(branchSession, emptyDefinition(), { today: TODAY });
      expect(names(result)).toContain("Kelompok Lain");
    });

    it("never lists or counts soft-deleted members", async () => {
      const result = await listViewMembers(
        leafSession,
        definitionWith([{ op: "AND", rules: [{ field: "age", operator: "gte", value: 17 }] }]),
        { today: TODAY },
      );
      expect(names(result)).not.toContain("Sudah Dihapus");
      expect(result.total).toBe(names(result).length);
    });

    it("ignores a group rule outside the viewer's scope instead of widening the result", async () => {
      const definition = definitionWith([
        { op: "AND", rules: [{ field: "group", operator: "inSubtreeOf", value: [fx.root.id] }] },
      ]);
      const result = await listViewMembers(leafSession, definition, { today: TODAY });
      expect(result.dropped).toBe(true);
      expect(names(result)).not.toContain("Kelompok Lain");
    });

    it("reports dropped = false when every rule applies", async () => {
      const result = await listViewMembers(leafSession, emptyDefinition(), { today: TODAY });
      expect(result.dropped).toBe(false);
    });

    it("applies a group rule within scope", async () => {
      const definition = definitionWith([
        { op: "AND", rules: [{ field: "group", operator: "inSubtreeOf", value: [fx.otherLeaf.id] }] },
      ]);
      const result = await listViewMembers(branchSession, definition, { today: TODAY });
      expect(names(result)).toEqual(["Kelompok Lain"]);
    });
  });

  describe("tag rules", () => {
    let own: { id: number };
    let sibling: { id: number };
    let gone: { id: number };

    const newTag = (groupId: number, key: string, extra: { deletedAt?: Date } = {}) =>
      db.tag.create({ data: { groupId, key, color: "blue", createdById: fx.actorId, ...extra } });
    const link = (memberId: number, tagId: number) => db.memberTag.create({ data: { memberId, tagId, createdById: fx.actorId } });
    const tagRule = (operator: "hasAnyOf" | "hasNoneOf", ids: number[]) =>
      definitionWith([{ op: "AND", rules: [{ field: "tag", operator, value: ids }] }]);

    beforeAll(async () => {
      own = await newTag(fx.branch.id, "tag-rule-own");
      sibling = await newTag(fx.otherLeaf.id, "tag-rule-sibling");
      gone = await newTag(fx.branch.id, "tag-rule-gone", { deletedAt: new Date() });
      const tagged = await makeMember(fx.leaf.id, "Bertag");
      await link(tagged.id, own.id);
      const otherLeafMember = await makeMember(fx.otherLeaf.id, "Bertag Sibling");
      await link(otherLeafMember.id, own.id);
      await link(otherLeafMember.id, sibling.id);
    });

    it("has any of: returns tagged members within the viewer's scope only", async () => {
      const result = await listViewMembers(leafSession, tagRule("hasAnyOf", [own.id]), { today: TODAY });
      expect(names(result)).toEqual(["Bertag"]);
      expect(result.dropped).toBe(false);
    });

    it("has none of: also returns members with no tags at all", async () => {
      const result = await listViewMembers(leafSession, tagRule("hasNoneOf", [own.id]), { today: TODAY });
      expect(names(result)).toContain("Anggota Uji");
      expect(names(result)).not.toContain("Bertag");
      expect(names(result)).not.toContain("Bertag Sibling");
    });

    it("a viewer above both leaves sees tagged members of both", async () => {
      const result = await listViewMembers(branchSession, tagRule("hasAnyOf", [own.id]), { today: TODAY });
      expect(names(result).sort()).toEqual(["Bertag", "Bertag Sibling"]);
    });

    it("ignores a tag the viewer cannot see instead of widening or leaking", async () => {
      const result = await listViewMembers(leafSession, tagRule("hasAnyOf", [sibling.id]), { today: TODAY });
      expect(result.dropped).toBe(true);
      expect(result.total).toBe((await listViewMembers(leafSession, emptyDefinition(), { today: TODAY })).total);
    });

    it("drops a deleted tag with the notice, keeping the rule's other tags", async () => {
      const result = await listViewMembers(leafSession, tagRule("hasAnyOf", [own.id, gone.id]), { today: TODAY });
      expect(result.dropped).toBe(true);
      expect(names(result)).toEqual(["Bertag"]);
    });
  });

  describe("age and boolean logic", () => {
    it("counts a birthday today and excludes the day before", async () => {
      const result = await listViewMembers(
        leafSession,
        definitionWith([{ op: "AND", rules: [{ field: "age", operator: "gte", value: 17 }] }]),
        { today: TODAY },
      );
      expect(names(result)).toContain("Ulang Tahun Hari Ini");
      expect(names(result)).not.toContain("Sehari Sebelum");
    });

    it("includes both ends of an age between range", async () => {
      const result = await listViewMembers(
        leafSession,
        definitionWith([{ op: "AND", rules: [{ field: "age", operator: "between", value: [15, 17] }] }]),
        { today: TODAY },
      );
      expect(names(result).sort()).toEqual(["Remaja Putri", "Sehari Sebelum", "Ulang Tahun Hari Ini"].sort());
    });

    it("AND of OR groups", async () => {
      const result = await listViewMembers(
        leafSession,
        definitionWith(
          [
            {
              op: "OR",
              rules: [
                { field: "sex", operator: "isAnyOf", value: ["L"] },
                { field: "sex", operator: "isAnyOf", value: ["P"] },
              ],
            },
            {
              op: "AND",
              rules: [
                { field: "age", operator: "gte", value: 13 },
                { field: "age", operator: "lte", value: 17 },
              ],
            },
          ],
          "AND",
        ),
        { today: TODAY },
      );
      expect(names(result).sort()).toEqual(["Remaja Putri", "Sehari Sebelum", "Ulang Tahun Hari Ini"].sort());
    });

    it("OR of AND groups", async () => {
      const result = await listViewMembers(
        leafSession,
        definitionWith(
          [
            {
              op: "AND",
              rules: [
                { field: "age", operator: "lte", value: 12 },
                { field: "sex", operator: "isAnyOf", value: ["P"] },
              ],
            },
            { op: "AND", rules: [{ field: "status", operator: "isAnyOf", value: ["PINDAH"] }] },
          ],
          "OR",
        ),
        { today: TODAY },
      );
      expect(names(result)).toEqual(["Pindah Putra"]);
    });
  });

  describe("sort and columns", () => {
    it("orders age descending with the oldest first", async () => {
      const result = await listViewMembers(
        leafSession,
        { ...emptyDefinition(), sort: { field: "age", dir: "desc" } },
        { today: TODAY },
      );
      expect(result.members[0].name).toBe("Pindah Putra");
    });

    it("selects only the chosen columns, so hidden PII never leaves the query", async () => {
      const result = await listViewMembers(
        leafSession,
        { ...emptyDefinition(), columns: ["jenisKelamin"] },
        { today: TODAY },
      );
      const row = result.members[0] as Record<string, unknown>;
      expect(row).toHaveProperty("name");
      expect(row).toHaveProperty("sex");
      for (const hidden of ["phone", "address", "email", "birthDate"]) expect(row).not.toHaveProperty(hidden);
    });

    it("selects the code only when the Kode column is chosen", async () => {
      const withCode = await listViewMembers(leafSession, { ...emptyDefinition(), columns: ["kode"] }, { today: TODAY });
      expect(withCode.members[0]).toHaveProperty("code");
      expect(withCode.members[0]).not.toHaveProperty("phone");

      const without = await listViewMembers(leafSession, { ...emptyDefinition(), columns: ["grup"] }, { today: TODAY });
      expect(without.members[0]).not.toHaveProperty("code");
    });

    it("selects the phone only when a phone column is chosen", async () => {
      const result = await listViewMembers(
        leafSession,
        { ...emptyDefinition(), columns: ["hp"] },
        { today: TODAY },
      );
      expect(result.members[0]).toHaveProperty("phone");
      expect(result.members[0]).not.toHaveProperty("address");
    });
  });

  describe("tag column (task 5.4)", () => {
    it("loads only the tags the viewer may see, and only when the Tag column is chosen", async () => {
      const visible = await db.tag.create({ data: { groupId: fx.root.id, key: "view-visible", color: "blue", createdById: fx.actorId } });
      const foreign = await db.tag.create({ data: { groupId: fx.otherLeaf.id, key: "view-foreign", color: "red", createdById: fx.actorId } });
      const deleted = await db.tag.create({ data: { groupId: fx.root.id, key: "view-deleted", color: "red", createdById: fx.actorId, deletedAt: new Date() } });
      for (const tag of [visible, foreign, deleted]) {
        await db.memberTag.create({ data: { memberId: fx.memberId, tagId: tag.id, createdById: fx.actorId } });
      }

      const withColumn = await listViewMembers(leafSession, { ...emptyDefinition(), columns: ["tag"] }, { today: TODAY });
      const row = withColumn.members.find((m) => m.id === fx.memberId) as unknown as { tags: { tag: { key: string } }[] };
      expect(row.tags.map((link) => link.tag.key)).toEqual(["view-visible"]);

      const without = await listViewMembers(leafSession, { ...emptyDefinition(), columns: ["jenisKelamin"] }, { today: TODAY });
      expect(without.members[0]).not.toHaveProperty("tags");
    });
  });

  describe("pagination", () => {
    it("pages PAGE_SIZE rows with the total, and clamps a stale page", async () => {
      await db.member.createMany({
        data: Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({
          groupId: fx.leaf.id,
          name: `Massal ${String(i).padStart(3, "0")}`,
          birthPlace: "Jakarta",
          birthDate: "1985-01-01",
          sex: "L",
          address: "-",
          phone: "0800000000",
          maritalStatus: "MENIKAH",
          workStatus: "BEKERJA",
          joinedAt: "2020-01-01",
          createdById: fx.actorId,
        })),
      });
      const definition = definitionWith([{ op: "AND", rules: [{ field: "name", operator: "contains", value: "Massal" }] }]);

      const first = await listViewMembers(leafSession, definition, { today: TODAY });
      expect(first.total).toBe(PAGE_SIZE + 1);
      expect(first.members).toHaveLength(PAGE_SIZE);
      expect(first.page).toBe(1);
      expect(first.pageSize).toBe(PAGE_SIZE);

      const last = await listViewMembers(leafSession, definition, { today: TODAY, page: 99 });
      expect(last.page).toBe(2);
      expect(last.members).toHaveLength(1);
    });
  });
});
