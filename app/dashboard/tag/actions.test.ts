import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor, type PageFixture } from "@/lib/test/fixtures";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
  attachTagAction,
  bulkTagMembersAction,
  createAndAttachTagAction,
  createTagAction,
  deleteTagAction,
  deleteTagKeyAction,
  detachTagAction,
  recolorTagAction,
  renameTagKeyAction,
  renameTagValueAction,
} from "./actions";

let fx: PageFixture;
let admin: ReturnType<typeof sessionFor>;
let user: ReturnType<typeof sessionFor>;

async function makeSession(username: string, role: "ADMIN" | "USER") {
  const row = await db.user.create({ data: { username, passwordHash: "x", name: username } });
  await db.userGroupRole.create({ data: { userId: row.id, groupId: fx.leaf.id, role } });
  return sessionFor(row.id, role, fx.leaf);
}

describe("tag actions (task 5.2)", () => {
  beforeAll(async () => {
    fx = await buildPageFixture("tag-actions");
    admin = await makeSession("tag-actions-admin", "ADMIN");
    user = await makeSession("tag-actions-user", "USER");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects a malformed target id with the generic validation error", async () => {
    mockAuthSession(auth, { user: admin });
    const result = await attachTagAction({ kind: "member", id: "abc", tagId: 1 });
    expect(result).toEqual({ ok: false, error: "Data tidak valid" });
  });

  it("createAndAttach creates a slate tag in the user's own group and attaches it to a member", async () => {
    mockAuthSession(auth, { user: admin });
    const result = await createAndAttachTagAction({ kind: "member", id: fx.memberId, name: "Prioritas:Tinggi" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.tag).toMatchObject({ groupId: fx.leaf.id, key: "prioritas", value: "tinggi", color: "slate" });
    const links = await db.memberTag.findMany({ where: { memberId: fx.memberId } });
    expect(links.map((l) => l.tagId)).toContain(result.data.tag.id);
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/anggota/${fx.memberId}`);
  });

  it("createAndAttach is forbidden for a USER and creates nothing", async () => {
    mockAuthSession(auth, { user });
    const before = await db.tag.count({ where: { groupId: fx.leaf.id } });
    const result = await createAndAttachTagAction({ kind: "activity", id: fx.activityId, name: "terlarang" });

    expect(result.ok).toBe(false);
    expect(await db.tag.count({ where: { groupId: fx.leaf.id } })).toBe(before);
  });

  it("createAndAttach reports a bad tag name as a validation message", async () => {
    mockAuthSession(auth, { user: admin });
    const result = await createAndAttachTagAction({ kind: "member", id: fx.memberId, name: "a:b:c" });
    expect(result).toEqual({ ok: false, error: 'Gunakan satu ":" untuk memisahkan kunci dan nilai' });
  });

  it("attach then detach on an activity round-trips and is idempotent", async () => {
    mockAuthSession(auth, { user: admin });
    const tag = await db.tag.create({
      data: { groupId: fx.leaf.id, key: "fokus-aksi", value: null, color: "blue", createdById: fx.actorId },
    });

    const attached = await attachTagAction({ kind: "activity", id: fx.activityId, tagId: tag.id });
    expect(attached).toMatchObject({ ok: true, data: { changed: true } });
    expect(await attachTagAction({ kind: "activity", id: fx.activityId, tagId: tag.id })).toMatchObject({
      ok: true,
      data: { changed: false },
    });

    const detached = await detachTagAction({ kind: "activity", id: fx.activityId, tagId: tag.id });
    expect(detached).toMatchObject({ ok: true, data: { changed: true } });
    expect(await db.activityTag.count({ where: { activityId: fx.activityId, tagId: tag.id } })).toBe(0);
  });

  it("returns a not-found message for a tag the user cannot see", async () => {
    mockAuthSession(auth, { user: admin });
    const result = await attachTagAction({ kind: "member", id: fx.memberId, tagId: 999999 });
    expect(result.ok).toBe(false);
  });

  describe("bulkTagMembersAction (task 5.5)", () => {
    const memberData = (name: string) => ({
      groupId: fx.leaf.id,
      name,
      birthPlace: "Jakarta",
      birthDate: "2000-01-01",
      sex: "L",
      address: "-",
      phone: "081200000002",
      maritalStatus: "BELUM_MENIKAH",
      workStatus: "BEKERJA",
      joinedAt: "2024-01-01",
      createdById: fx.actorId,
    });

    it("adds a tag to every selected member and reports how many changed", async () => {
      mockAuthSession(auth, { user: admin });
      const tag = await db.tag.create({ data: { groupId: fx.leaf.id, key: "massal-a", color: "blue", createdById: fx.actorId } });
      const a = await db.member.create({ data: memberData("Massal A") });
      const b = await db.member.create({ data: memberData("Massal B") });

      const result = await bulkTagMembersAction({ memberIds: [a.id, b.id], tagId: tag.id, op: "add" });

      expect(result).toEqual({ ok: true, data: { changed: 2 } });
      expect(await db.memberTag.count({ where: { tagId: tag.id } })).toBe(2);
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard/anggota");
    });

    it("removes a tag only from the members that have it", async () => {
      mockAuthSession(auth, { user: admin });
      const tag = await db.tag.create({ data: { groupId: fx.leaf.id, key: "massal-b", color: "blue", createdById: fx.actorId } });
      const a = await db.member.create({ data: memberData("Massal C") });
      const b = await db.member.create({ data: memberData("Massal D") });
      await db.memberTag.create({ data: { memberId: a.id, tagId: tag.id, createdById: fx.actorId } });

      const result = await bulkTagMembersAction({ memberIds: [a.id, b.id], tagId: tag.id, op: "remove" });

      expect(result).toEqual({ ok: true, data: { changed: 1 } });
      expect(await db.memberTag.count({ where: { tagId: tag.id } })).toBe(0);
    });

    it("rejects the whole batch when one id is outside the user's scope", async () => {
      mockAuthSession(auth, { user: admin });
      const tag = await db.tag.create({ data: { groupId: fx.leaf.id, key: "massal-c", color: "blue", createdById: fx.actorId } });
      const mine = await db.member.create({ data: memberData("Massal E") });
      const foreign = await db.member.create({ data: { ...memberData("Massal Asing"), groupId: fx.otherLeaf.id } });

      const result = await bulkTagMembersAction({ memberIds: [mine.id, foreign.id], tagId: tag.id, op: "add" });

      expect(result.ok).toBe(false);
      expect(await db.memberTag.count({ where: { tagId: tag.id } })).toBe(0);
    });

    it("reports an empty selection and a malformed payload with a validation message", async () => {
      mockAuthSession(auth, { user: admin });
      expect(await bulkTagMembersAction({ memberIds: [], tagId: 1, op: "add" })).toEqual({
        ok: false,
        error: "Pilih minimal satu anggota",
      });
      expect(await bulkTagMembersAction({ memberIds: [1], tagId: 1, op: "hapus" })).toMatchObject({ ok: false });
    });
  });

  describe("tag management actions (task 5.7)", () => {
    const make = (key: string, value: string | null = null, groupId = fx.leaf.id) =>
      db.tag.create({ data: { groupId, key, value, color: "blue", createdById: fx.actorId } });

    it("creates a tag in the caller's own group with the chosen color", async () => {
      mockAuthSession(auth, { user: admin });
      const result = await createTagAction({ name: "Kelola:Satu", color: "green" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toMatchObject({ groupId: fx.leaf.id, key: "kelola", value: "satu", color: "green" });
      expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/grup/${fx.leaf.id}`);
    });

    it("rejects a color outside the palette and a bad name with a validation message", async () => {
      mockAuthSession(auth, { user: admin });
      expect(await createTagAction({ name: "ok", color: "#ff00ff" })).toEqual({ ok: false, error: "Warna tidak valid" });
      expect(await createTagAction({ name: "a:b:c", color: "blue" })).toMatchObject({ ok: false });
    });

    it("recolors a tag", async () => {
      mockAuthSession(auth, { user: admin });
      const tag = await make("warna-uji");
      expect(await recolorTagAction({ tagId: tag.id, color: "pink" })).toMatchObject({ ok: true, data: { color: "pink" } });
      expect((await db.tag.findUniqueOrThrow({ where: { id: tag.id } })).color).toBe("pink");
    });

    it("renames a key on every value, and one value on its own", async () => {
      mockAuthSession(auth, { user: admin });
      const high = await make("nama-lama", "tinggi");
      const low = await make("nama-lama", "rendah");

      expect(await renameTagKeyAction({ tagId: high.id, newKey: "Nama-Baru" })).toMatchObject({ ok: true });
      expect((await db.tag.findMany({ where: { id: { in: [high.id, low.id] } } })).map((t) => t.key)).toEqual(["nama-baru", "nama-baru"]);

      expect(await renameTagValueAction({ tagId: low.id, newValue: "sedang" })).toMatchObject({ ok: true });
      expect((await db.tag.findUniqueOrThrow({ where: { id: low.id } })).value).toBe("sedang");
    });

    it("soft-deletes one tag, or a whole key", async () => {
      mockAuthSession(auth, { user: admin });
      const one = await make("hapus-satu");
      const a = await make("hapus-kunci", "a");
      const b = await make("hapus-kunci", "b");

      expect(await deleteTagAction({ tagId: one.id })).toMatchObject({ ok: true });
      expect(await db.tag.count({ where: { id: one.id } })).toBe(0);

      expect(await deleteTagKeyAction({ tagId: a.id })).toMatchObject({ ok: true });
      expect(await db.tag.count({ where: { id: { in: [a.id, b.id] } } })).toBe(0);
    });

    it("refuses a USER with a message and changes nothing", async () => {
      mockAuthSession(auth, { user });
      const tag = await make("dilindungi");
      expect(await recolorTagAction({ tagId: tag.id, color: "red" })).toMatchObject({ ok: false });
      expect(await deleteTagAction({ tagId: tag.id })).toMatchObject({ ok: false });
      expect((await db.tag.findUniqueOrThrow({ where: { id: tag.id } })).color).toBe("blue");
    });

    it("refuses an ADMIN of an ancestor group for a descendant's tag", async () => {
      const tag = await make("milik-leaf");
      const row = await db.user.create({ data: { username: "tag-actions-branch-admin", passwordHash: "x", name: "B" } });
      await db.userGroupRole.create({ data: { userId: row.id, groupId: fx.branch.id, role: "ADMIN" } });
      mockAuthSession(auth, { user: sessionFor(row.id, "ADMIN", fx.branch) });

      expect(await recolorTagAction({ tagId: tag.id, color: "red" })).toMatchObject({ ok: false });
      expect((await db.tag.findUniqueOrThrow({ where: { id: tag.id } })).color).toBe("blue");
    });

    it("reports a malformed id with the generic validation error", async () => {
      mockAuthSession(auth, { user: admin });
      expect(await deleteTagAction({ tagId: "abc" })).toEqual({ ok: false, error: "Data tidak valid" });
    });
  });
});
