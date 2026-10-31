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
});
