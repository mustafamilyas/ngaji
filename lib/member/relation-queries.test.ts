import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { RELATION_PICKER_LIMIT } from "@/lib/constants";
import { NotFoundError } from "@/lib/errors";
import { generateMemberCode } from "@/lib/member/code";
import { buildPageFixture, fixtureCodePrefix, sessionFor, type PageFixture } from "@/lib/test/fixtures";
import { getMemberRelatives, searchRelativeCandidates } from "./relation-queries";

let fx: PageFixture;
let other: PageFixture;

async function newMember(groupId: number, name: string, sex: "L" | "P", deletedAt: Date | null = null) {
  const group = await db.group.findUniqueOrThrow({ where: { id: groupId }, select: { organizationId: true } });
  const member = await db.member.create({
    data: {
      groupId,
      code: generateMemberCode(fixtureCodePrefix(group.organizationId)),
      name,
      birthPlace: "Bandung",
      birthDate: "1990-01-01",
      sex,
      phone: "081234567890",
      address: "Jl. Rahasia 1",
      maritalStatus: "MENIKAH",
      workStatus: "BEKERJA",
      joinedAt: "2024-01-01",
      createdById: fx.actorId,
      deletedAt,
    },
  });
  return member.id;
}

function relate(fromMemberId: number, toMemberId: number, type: string) {
  return db.memberRelation.create({ data: { fromMemberId, toMemberId, type, createdById: fx.actorId } });
}

describe("lib/member/relation-queries", () => {
  beforeAll(async () => {
    fx = await buildPageFixture("relatives-a");
    other = await buildPageFixture("relatives-b");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const user = () => sessionFor(fx.actorId, "USER", fx.leaf);

  describe("getMemberRelatives", () => {

  it("labels relatives from the viewed member's side and orders them by section, then name", async () => {
    const me = await newMember(fx.leaf.id, "Fatimah", "P");
    const father = await newMember(fx.leaf.id, "Ahmad", "L");
    const guardian = await newMember(fx.leaf.id, "Umar", "L");
    const husband = await newMember(fx.leaf.id, "Budi", "L");
    const brother = await newMember(fx.leaf.id, "Zaid", "L");
    const sister = await newMember(fx.leaf.id, "Aisyah", "P");
    const son = await newMember(fx.leaf.id, "Hasan", "L");
    await relate(father, me, "ORANG_TUA");
    await relate(guardian, me, "WALI");
    await relate(Math.min(me, husband), Math.max(me, husband), "PASANGAN");
    await relate(Math.min(me, brother), Math.max(me, brother), "SAUDARA");
    await relate(Math.min(me, sister), Math.max(me, sister), "SAUDARA");
    await relate(me, son, "ORANG_TUA");

    const relatives = await getMemberRelatives(user(), me);

    expect(relatives.map((r) => [r.label, r.name])).toEqual([
      ["Ayah", "Ahmad"],
      ["Wali", "Umar"],
      ["Suami", "Budi"],
      ["Saudara perempuan", "Aisyah"],
      ["Saudara laki-laki", "Zaid"],
      ["Anak laki-laki", "Hasan"],
    ]);
  });

  it("gives an in-scope relative its member id and link id", async () => {
    const me = await newMember(fx.leaf.id, "Dalam Saya", "L");
    const sibling = await newMember(fx.leaf.id, "Dalam Saudara", "P");
    const relation = await relate(Math.min(me, sibling), Math.max(me, sibling), "SAUDARA");

    expect(await getMemberRelatives(user(), me)).toEqual([
      { inScope: true, memberId: sibling, relationId: relation.id, label: "Saudara perempuan", name: "Dalam Saudara", groupName: "Leaf" },
    ]);
  });

  it("strips an out-of-scope relative to name, group name and label", async () => {
    const me = await newMember(fx.leaf.id, "Luar Anak", "P");
    const mother = await newMember(fx.otherLeaf.id, "Luar Ibu", "P");
    await relate(mother, me, "ORANG_TUA");

    const relatives = await getMemberRelatives(user(), me);

    expect(relatives).toEqual([{ inScope: false, label: "Ibu", name: "Luar Ibu", groupName: "Other Leaf" }]);
    const payload = JSON.stringify(relatives);
    for (const leaked of [String(mother), "081234567890", "Jl. Rahasia", "1990-01-01"]) {
      expect(payload).not.toContain(leaked);
    }
  });

  it("hides links to a soft-deleted relative and keeps the row", async () => {
    const me = await newMember(fx.leaf.id, "Hapus Saya", "L");
    const gone = await newMember(fx.leaf.id, "Hapus Kerabat", "L", new Date());
    const relation = await relate(me, gone, "WALI");

    expect(await getMemberRelatives(user(), me)).toEqual([]);
    expect(await db.memberRelation.findUnique({ where: { id: relation.id } })).not.toBeNull();
  });

  it("answers not found for a viewed member outside scope or in another organization", async () => {
    const sibling = await newMember(fx.otherLeaf.id, "Sebelah", "L");
    await expect(getMemberRelatives(user(), sibling)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getMemberRelatives(sessionFor(fx.actorId, "OWNER", fx.root), other.memberId)).rejects.toBeInstanceOf(NotFoundError);
  });
  });

  describe("searchRelativeCandidates", () => {
    const codeOf = async (id: number) => {
      const { code } = await db.member.findUniqueOrThrow({ where: { id }, select: { code: true } });
      if (!code) throw new Error(`member ${id} has no code`);
      return code;
    };

    it("matches names in scope only and leaves out the member themself", async () => {
      const me = await newMember(fx.leaf.id, "Cari Kirana", "P");
      const mine = await newMember(fx.leaf.id, "Cari Kirana Adik", "P");
      await newMember(fx.otherLeaf.id, "Cari Kirana Sebelah", "P");
      await newMember(other.leaf.id, "Cari Kirana Lain", "P");

      expect(await searchRelativeCandidates(user(), me, "kirana")).toEqual([
        { id: mine, name: "Cari Kirana Adik", groupName: "Leaf", code: await codeOf(mine) },
      ]);
    });

    it("finds a member in scope by a full code typed loosely", async () => {
      const me = await newMember(fx.leaf.id, "Kode Saya", "L");
      const target = await newMember(fx.leaf.id, "Kode Target", "L");
      const loose = (await codeOf(target)).replace("-", "").toLowerCase();

      expect((await searchRelativeCandidates(user(), me, loose)).map((c) => c.id)).toEqual([target]);
    });

    it("finds nothing by the code of a member outside scope or in another organization", async () => {
      const me = await newMember(fx.leaf.id, "Kode Luar Saya", "L");
      const sibling = await newMember(fx.otherLeaf.id, "Kode Luar Sebelah", "L");
      const otherOrg = await newMember(other.leaf.id, "Kode Luar Organisasi", "L");

      expect(await searchRelativeCandidates(user(), me, await codeOf(sibling))).toEqual([]);
      expect(await searchRelativeCandidates(user(), me, await codeOf(otherOrg))).toEqual([]);
    });

    it(`leaves out soft-deleted members and returns at most ${RELATION_PICKER_LIMIT}, by name`, async () => {
      const me = await newMember(fx.leaf.id, "Batas Saya", "L");
      await newMember(fx.leaf.id, "Batas Calon 00", "L", new Date());
      for (let i = 1; i <= RELATION_PICKER_LIMIT + 2; i++) await newMember(fx.leaf.id, `Batas Calon ${String(i).padStart(2, "0")}`, "L");

      const names = (await searchRelativeCandidates(user(), me, "batas calon")).map((c) => c.name);

      expect(names).toEqual(Array.from({ length: RELATION_PICKER_LIMIT }, (_, i) => `Batas Calon ${String(i + 1).padStart(2, "0")}`));
    });

    it("returns nothing for a blank query", async () => {
      const me = await newMember(fx.leaf.id, "Kosong Saya", "L");
      expect(await searchRelativeCandidates(user(), me, "   ")).toEqual([]);
    });

    it("answers not found when the viewed member is outside scope", async () => {
      const sibling = await newMember(fx.otherLeaf.id, "Cari Dari Sebelah", "L");
      await expect(searchRelativeCandidates(user(), sibling, "cari")).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
