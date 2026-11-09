import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { RELATION_MAX_PER_MEMBER } from "@/lib/constants";
import { buildPageFixture, sessionFor, type PageFixture } from "@/lib/test/fixtures";
import { linkMembers, unlinkMembers } from "./relation-mutations";

let fx: PageFixture;
let other: PageFixture;

async function newMember(groupId: number, name: string, extra: { status?: string; exitedAt?: string; deletedAt?: Date } = {}) {
  const member = await db.member.create({
    data: {
      groupId,
      name,
      birthPlace: "Bandung",
      birthDate: "1990-01-01",
      sex: "L",
      address: "-",
      maritalStatus: "MENIKAH",
      workStatus: "BEKERJA",
      joinedAt: "2024-01-01",
      createdById: fx.actorId,
      status: extra.status ?? "AKTIF",
      exitedAt: extra.exitedAt ?? null,
      deletedAt: extra.deletedAt ?? null,
    },
  });
  return member.id;
}

const relationAudits = () =>
  db.auditLog.count({ where: { action: { in: ["member.relate", "member.unrelate"] }, actorId: { in: [fx.actorId, other.actorId] } } });

const relationsOf = (memberId: number) =>
  db.memberRelation.findMany({ where: { OR: [{ fromMemberId: memberId }, { toMemberId: memberId }] } });

describe("lib/member/relation-mutations", () => {
  beforeAll(async () => {
    fx = await buildPageFixture("relations-a");
    other = await buildPageFixture("relations-b");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const user = () => sessionFor(fx.actorId, "USER", fx.leaf);
  const branchAdmin = () => sessionFor(fx.actorId, "ADMIN", fx.branch);

  describe("linkMembers", () => {
    it("creates one directed link and a member.relate audit on the first member's group", async () => {
      const parent = await newMember(fx.leaf.id, "Ahmad Ayah");
      const child = await newMember(fx.leaf.id, "Fatimah Anak");

      const relation = await linkMembers(user(), { fromMemberId: parent, toMemberId: child, type: "ORANG_TUA" });

      expect(relation).toMatchObject({ fromMemberId: parent, toMemberId: child, type: "ORANG_TUA", createdById: fx.actorId });
      const entry = await db.auditLog.findFirstOrThrow({ where: { action: "member.relate", entityId: relation.id } });
      expect(entry).toMatchObject({ actorId: fx.actorId, entity: "MemberRelation", groupId: fx.leaf.id });
      expect(entry.meta).toEqual({ fromMemberId: parent, toMemberId: child, type: "ORANG_TUA" });
    });

    it("stores a symmetric link once, smaller id first", async () => {
      const first = await newMember(fx.leaf.id, "Budi Suami");
      const second = await newMember(fx.leaf.id, "Siti Istri");

      const relation = await linkMembers(user(), { fromMemberId: second, toMemberId: first, type: "PASANGAN" });

      expect(relation).toMatchObject({ fromMemberId: first, toMemberId: second });
      expect(await relationsOf(first)).toHaveLength(1);
    });

    it("links a member who has exited", async () => {
      const active = await newMember(fx.leaf.id, "Aktif");
      const exited = await newMember(fx.leaf.id, "Keluar", { status: "KELUAR", exitedAt: "2024-06-01" });
      await expect(linkMembers(user(), { fromMemberId: active, toMemberId: exited, type: "SAUDARA" })).resolves.toBeDefined();
    });

    it("lets an ADMIN of the branch link members of two leaf groups under it", async () => {
      const a = await newMember(fx.leaf.id, "Lintas Satu");
      const b = await newMember(fx.otherLeaf.id, "Lintas Dua");
      await expect(linkMembers(branchAdmin(), { fromMemberId: a, toMemberId: b, type: "SAUDARA" })).resolves.toBeDefined();
    });

    describe("rejections write nothing", () => {
      async function expectRejected(promise: Promise<unknown>, error: typeof NotFoundError | typeof ValidationError, ids: number[]) {
        const audits = await relationAudits();
        const before = await Promise.all(ids.map(relationsOf));
        await expect(promise).rejects.toBeInstanceOf(error);
        expect(await relationAudits()).toBe(audits);
        expect(await Promise.all(ids.map(relationsOf))).toEqual(before);
      }

      it("rejects linking a member to themself", async () => {
        const member = await newMember(fx.leaf.id, "Sendiri");
        await expectRejected(linkMembers(user(), { fromMemberId: member, toMemberId: member, type: "SAUDARA" }), ValidationError, [member]);
      });

      it("rejects a reverse parent link with the spec's message", async () => {
        const a = await newMember(fx.leaf.id, "Balik A");
        const b = await newMember(fx.leaf.id, "Balik B");
        await linkMembers(user(), { fromMemberId: a, toMemberId: b, type: "ORANG_TUA" });

        await expectRejected(linkMembers(user(), { fromMemberId: b, toMemberId: a, type: "ORANG_TUA" }), ValidationError, [a, b]);
        await expect(linkMembers(user(), { fromMemberId: b, toMemberId: a, type: "ORANG_TUA" })).rejects.toThrow(
          "Kedua anggota sudah memiliki hubungan",
        );
      });

      it("rejects a second type for the same pair, and the same link twice", async () => {
        const a = await newMember(fx.leaf.id, "Dua Jenis A");
        const b = await newMember(fx.leaf.id, "Dua Jenis B");
        await linkMembers(user(), { fromMemberId: a, toMemberId: b, type: "SAUDARA" });

        await expectRejected(linkMembers(user(), { fromMemberId: b, toMemberId: a, type: "PASANGAN" }), ValidationError, [a, b]);
        await expectRejected(linkMembers(user(), { fromMemberId: a, toMemberId: b, type: "SAUDARA" }), ValidationError, [a, b]);
      });

      it("answers not found for a soft-deleted member", async () => {
        const live = await newMember(fx.leaf.id, "Hidup");
        const deleted = await newMember(fx.leaf.id, "Terhapus", { deletedAt: new Date() });
        await expectRejected(linkMembers(user(), { fromMemberId: live, toMemberId: deleted, type: "SAUDARA" }), NotFoundError, [live, deleted]);
      });

      it("answers not found when the relative is in a sibling leaf group, in either order", async () => {
        const mine = await newMember(fx.leaf.id, "Milik Sendiri");
        const sibling = await newMember(fx.otherLeaf.id, "Kelompok Sebelah");
        await expectRejected(linkMembers(user(), { fromMemberId: mine, toMemberId: sibling, type: "ORANG_TUA" }), NotFoundError, [mine, sibling]);
        await expectRejected(linkMembers(user(), { fromMemberId: sibling, toMemberId: mine, type: "ORANG_TUA" }), NotFoundError, [mine, sibling]);
      });

      it("answers not found for a member of another organization", async () => {
        const mine = await newMember(fx.leaf.id, "Organisasi Sendiri");
        const owner = sessionFor(fx.actorId, "OWNER", fx.root);
        await expectRejected(linkMembers(owner, { fromMemberId: mine, toMemberId: other.memberId, type: "SAUDARA" }), NotFoundError, [mine, other.memberId]);
      });

      it(`rejects a link when either member already has ${RELATION_MAX_PER_MEMBER} visible links; links to deleted relatives do not count`, async () => {
        const full = await newMember(fx.leaf.id, "Penuh");
        const relatives = [];
        for (let i = 0; i < RELATION_MAX_PER_MEMBER - 1; i++) relatives.push(await newMember(fx.leaf.id, `Kerabat ${i}`));
        const hidden = await newMember(fx.leaf.id, "Kerabat Terhapus", { deletedAt: new Date() });
        await db.memberRelation.createMany({
          data: [...relatives, hidden].map((id) => ({ fromMemberId: full, toMemberId: id, type: "WALI", createdById: fx.actorId })),
        });

        const last = await newMember(fx.leaf.id, "Kerabat Terakhir");
        await expect(linkMembers(user(), { fromMemberId: full, toMemberId: last, type: "WALI" })).resolves.toBeDefined();

        const extra = await newMember(fx.leaf.id, "Kerabat Lebih");
        await expectRejected(linkMembers(user(), { fromMemberId: full, toMemberId: extra, type: "WALI" }), ValidationError, [full, extra]);
        await expectRejected(linkMembers(user(), { fromMemberId: extra, toMemberId: full, type: "WALI" }), ValidationError, [full, extra]);
      });
    });
  });

  describe("unlinkMembers", () => {
    it("deletes the link and writes member.unrelate with its members and type", async () => {
      const a = await newMember(fx.leaf.id, "Lepas A");
      const b = await newMember(fx.leaf.id, "Lepas B");
      const relation = await linkMembers(user(), { fromMemberId: a, toMemberId: b, type: "WALI" });

      await unlinkMembers(user(), { relationId: relation.id });

      expect(await db.memberRelation.findUnique({ where: { id: relation.id } })).toBeNull();
      const entry = await db.auditLog.findFirstOrThrow({ where: { action: "member.unrelate", entityId: relation.id } });
      expect(entry).toMatchObject({ actorId: fx.actorId, entity: "MemberRelation", groupId: fx.leaf.id });
      expect(entry.meta).toEqual({ fromMemberId: a, toMemberId: b, type: "WALI" });
    });

    it("answers not found for a link with a member outside scope and keeps it", async () => {
      const mine = await newMember(fx.leaf.id, "Lepas Milik");
      const sibling = await newMember(fx.otherLeaf.id, "Lepas Sebelah");
      const relation = await linkMembers(branchAdmin(), { fromMemberId: mine, toMemberId: sibling, type: "SAUDARA" });
      const audits = await relationAudits();

      await expect(unlinkMembers(user(), { relationId: relation.id })).rejects.toBeInstanceOf(NotFoundError);
      expect(await db.memberRelation.findUnique({ where: { id: relation.id } })).not.toBeNull();
      expect(await relationAudits()).toBe(audits);
    });

    it("answers not found for a link id that does not exist or belongs to another organization", async () => {
      await expect(unlinkMembers(user(), { relationId: 999_999 })).rejects.toBeInstanceOf(NotFoundError);

      const otherRelative = await newMember(other.leaf.id, "Lain A");
      const relation = await db.memberRelation.create({
        data: { fromMemberId: other.memberId, toMemberId: otherRelative, type: "SAUDARA", createdById: other.actorId },
      });
      await expect(unlinkMembers(sessionFor(fx.actorId, "OWNER", fx.root), { relationId: relation.id })).rejects.toBeInstanceOf(NotFoundError);
      expect(await db.memberRelation.findUnique({ where: { id: relation.id } })).not.toBeNull();
    });
  });
});
