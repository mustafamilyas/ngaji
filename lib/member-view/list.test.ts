import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { buildPageFixture, sessionFor, type PageFixture } from "@/lib/test/fixtures";
import { emptyDefinition } from "@/lib/validation/member-view";
import { listMemberViews } from "./list";

let fx: PageFixture;
let leafSession: ReturnType<typeof sessionFor>;
let ownerId: number;
let movedOwnerId: number;
let inactiveOwnerId: number;

async function makeUser(username: string, groupId: number, isActive = true) {
  const user = await db.user.create({ data: { username, passwordHash: "x", name: username, isActive } });
  await db.userGroupRole.create({ data: { userId: user.id, groupId, role: "USER" } });
  return user;
}

function makeView(groupId: number, ownerId: number, name: string, extra: Record<string, unknown> = {}) {
  return db.memberView.create({
    data: { groupId, ownerId, createdById: ownerId, name, definition: emptyDefinition() as unknown as Prisma.InputJsonValue, ...extra },
  });
}

const names = (result: { views: { name: string }[] }) => result.views.map((v) => v.name);

describe("lib/member-view/list listMemberViews", () => {
  beforeAll(async () => {
    fx = await buildPageFixture("view-list");
    const owner = await makeUser("view-list-owner", fx.leaf.id);
    const moved = await makeUser("view-list-moved", fx.otherLeaf.id);
    const inactive = await makeUser("view-list-inactive", fx.leaf.id, false);
    ownerId = owner.id;
    movedOwnerId = moved.id;
    inactiveOwnerId = inactive.id;
    leafSession = sessionFor(ownerId, "USER", fx.leaf);

    await makeView(fx.leaf.id, ownerId, "Remaja Aktif");
    await makeView(fx.leaf.id, ownerId, "Daftar Remaja");
    await makeView(fx.leaf.id, ownerId, "Anak-anak");
    await makeView(fx.leaf.id, ownerId, "Sudah Dihapus", { deletedAt: new Date() });
    await makeView(fx.leaf.id, movedOwnerId, "Pemilik Pindah");
    await makeView(fx.leaf.id, inactiveOwnerId, "Pemilik Nonaktif");
    await makeView(fx.branch.id, ownerId, "Milik Ancestor");
    await makeView(fx.otherLeaf.id, movedOwnerId, "Milik Saudara");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe("Visible to the same group only", () => {
    it("lists only non-deleted views of the viewer's exact group", async () => {
      const result = await listMemberViews(leafSession);
      expect(names(result)).toEqual(["Anak-anak", "Daftar Remaja", "Pemilik Nonaktif", "Pemilik Pindah", "Remaja Aktif"]);
      expect(result.total).toBe(5);
    });

    it("never lists ancestor or descendant views", async () => {
      const branchSession = sessionFor(ownerId, "OWNER", fx.branch);
      expect(names(await listMemberViews(branchSession))).toEqual(["Milik Ancestor"]);

      const rootSession = sessionFor(ownerId, "OWNER", fx.root);
      const rootResult = await listMemberViews(rootSession);
      expect(rootResult.views).toEqual([]);
      expect(rootResult.total).toBe(0);
    });
  });

  describe("Row fields", () => {
    it("returns name, owner name, last updated and the orphaned flag", async () => {
      const result = await listMemberViews(leafSession, { search: "Remaja Aktif" });
      expect(result.views).toHaveLength(1);
      expect(result.views[0]).toMatchObject({ name: "Remaja Aktif", ownerId, ownerName: "view-list-owner", orphaned: false });
      expect(result.views[0].updatedAt).toBeInstanceOf(Date);
    });

    it("flags a view orphaned when its owner moved to another group", async () => {
      const [view] = (await listMemberViews(leafSession, { search: "Pemilik Pindah" })).views;
      expect(view.orphaned).toBe(true);
    });

    it("flags a view orphaned when its owner is deactivated", async () => {
      const [view] = (await listMemberViews(leafSession, { search: "Pemilik Nonaktif" })).views;
      expect(view.orphaned).toBe(true);
    });
  });

  describe("Search", () => {
    it("matches names containing the trimmed term", async () => {
      expect(names(await listMemberViews(leafSession, { search: "  remaja " }))).toEqual(["Daftar Remaja", "Remaja Aktif"]);
    });

    it("treats a blank search as no filter", async () => {
      expect((await listMemberViews(leafSession, { search: "   " })).total).toBe(5);
    });

    it("never searches outside the viewer's group", async () => {
      expect(names(await listMemberViews(leafSession, { search: "Ancestor" }))).toEqual([]);
      expect(names(await listMemberViews(leafSession, { search: "Saudara" }))).toEqual([]);
    });
  });

  describe("Pagination", () => {
    it("pages by PAGE_SIZE and clamps a stale page", async () => {
      const tail = sessionFor(ownerId, "USER", fx.otherLeaf);
      for (let i = 0; i < PAGE_SIZE + 1; i++) {
        await makeView(fx.otherLeaf.id, movedOwnerId, `Halaman ${String(i).padStart(3, "0")}`);
      }
      const first = await listMemberViews(tail);
      expect(first.views).toHaveLength(PAGE_SIZE);
      expect(first.total).toBe(PAGE_SIZE + 2); // + "Milik Saudara"

      const stale = await listMemberViews(tail, { page: 99 });
      expect(stale.page).toBe(2);
      expect(stale.views).toHaveLength(2);
    });
  });
});
