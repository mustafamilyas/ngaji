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
  detachTagAction,
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
});
