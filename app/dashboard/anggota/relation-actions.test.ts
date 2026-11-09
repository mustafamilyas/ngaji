import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { generateMemberCode } from "@/lib/member/code";
import { buildPageFixture, fixtureCodePrefix, mockAuthSession, type PageFixture, sessionFor } from "@/lib/test/fixtures";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { linkMembersAction, searchRelativeCandidatesAction, unlinkMembersAction } from "./actions";

describe("member relation actions", () => {
  let fx: PageFixture;
  let relative: number;
  let relativeCode: string;

  beforeAll(async () => {
    fx = await buildPageFixture("relation-actions");
    const member = await db.member.findUniqueOrThrow({ where: { id: fx.memberId } });
    relativeCode = generateMemberCode(fixtureCodePrefix(fx.organizationId));
    relative = (await db.member.create({ data: { ...member, id: undefined, code: relativeCode, name: "Kerabat Aksi" } })).id;
  });

  beforeEach(() => {
    vi.mocked(revalidatePath).mockClear();
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "USER", fx.leaf) });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const linksBetween = () =>
    db.memberRelation.count({ where: { fromMemberId: { in: [fx.memberId, relative] }, toMemberId: { in: [fx.memberId, relative] } } });

  it("rejects an unknown relationship type and writes nothing", async () => {
    const result = await linkMembersAction({ fromMemberId: fx.memberId, toMemberId: relative, type: "KAKEK" });
    expect(result).toEqual({ ok: false, error: "Jenis hubungan tidak valid" });
    expect(await linksBetween()).toBe(0);
  });

  it("answers the generic not-found error for a member outside scope", async () => {
    const result = await linkMembersAction({ fromMemberId: fx.memberId, toMemberId: 999_999, type: "SAUDARA" });
    expect(result).toEqual({ ok: false, error: "Data tidak ditemukan" });
  });

  it("links and unlinks, refreshing both members' pages each time", async () => {
    const linked = await linkMembersAction({ fromMemberId: String(fx.memberId), toMemberId: String(relative), type: "ORANG_TUA" });
    if (!linked.ok) throw new Error(linked.error);
    expect(vi.mocked(revalidatePath).mock.calls.flat()).toEqual([`/dashboard/anggota/${fx.memberId}`, `/dashboard/anggota/${relative}`]);

    vi.mocked(revalidatePath).mockClear();
    expect(await unlinkMembersAction({ relationId: linked.data.id })).toEqual({ ok: true, data: null });
    expect(vi.mocked(revalidatePath).mock.calls.flat()).toEqual([`/dashboard/anggota/${fx.memberId}`, `/dashboard/anggota/${relative}`]);
    expect(await linksBetween()).toBe(0);
  });

  it("searches candidates in scope and answers not found for a viewed member outside scope", async () => {
    const result = await searchRelativeCandidatesAction({ memberId: String(fx.memberId), query: "Kerabat Aksi" });
    expect(result).toEqual({ ok: true, data: [{ id: relative, name: "Kerabat Aksi", groupName: "Leaf", code: relativeCode }] });
    expect(await searchRelativeCandidatesAction({ memberId: 999_999, query: "Kerabat" })).toEqual({ ok: false, error: "Data tidak ditemukan" });
  });

  it("rejects an overlong query", async () => {
    const result = await searchRelativeCandidatesAction({ memberId: fx.memberId, query: "a".repeat(201) });
    expect(result).toEqual({ ok: false, error: "Pencarian terlalu panjang" });
  });
});
