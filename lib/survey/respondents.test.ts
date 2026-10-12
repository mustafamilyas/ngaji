import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { type PageFixture, buildPageFixture, sessionFor } from "@/lib/test/fixtures";
import { listRespondents } from "./respondents";

describe("lib/survey/respondents", () => {
  let fx: PageFixture;
  let surveyId: number;
  let otherLeafMemberId: number;
  let leftMemberId: number;

  async function member(name: string, groupId: number, extra: { status?: string; deletedAt?: Date } = {}) {
    return (
      await db.member.create({
        data: {
          groupId,
          name,
          birthPlace: "Jakarta",
          birthDate: "2000-01-01",
          sex: "P",
          address: "Jl. Uji No. 3",
          phone: "081200000002",
          maritalStatus: "BELUM_MENIKAH",
          workStatus: "BEKERJA",
          status: extra.status ?? "AKTIF",
          joinedAt: "2024-01-01",
          createdById: fx.actorId,
          deletedAt: extra.deletedAt,
        },
      })
    ).id;
  }

  async function respond(memberId: number, updatedAt: Date) {
    await db.surveyResponse.create({ data: { surveyId, memberId, recordedById: fx.actorId, updatedAt } });
  }

  beforeAll(async () => {
    fx = await buildPageFixture("survey-respondents");
    surveyId = (await db.survey.create({ data: { groupId: fx.branch.id, createdById: fx.actorId, title: "Uji" } })).id;

    otherLeafMemberId = await member("Budi Lain", fx.otherLeaf.id);
    leftMemberId = await member("Citra Keluar", fx.leaf.id, { status: "KELUAR" });
    const deletedMemberId = await member("Dewi Terhapus", fx.leaf.id, { deletedAt: new Date() });

    const day = (n: number) => new Date(Date.UTC(2026, 0, n));
    await respond(fx.memberId, day(1));
    await respond(otherLeafMemberId, day(2));
    await respond(leftMemberId, day(3));
    await respond(deletedMemberId, day(4));
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("lists only responses of members in the caller's scope, newest saved first, without deleted members", async () => {
    const result = await listRespondents(sessionFor(fx.actorId, "USER", fx.leaf), surveyId);

    expect(result.respondents.map((r) => r.name)).toEqual(["Citra Keluar", "Anggota Uji"]);
    expect(result.total).toBe(2);
  });

  it("lists the whole subtree to a user in the owning group", async () => {
    const result = await listRespondents(sessionFor(fx.actorId, "ADMIN", fx.branch), surveyId);

    expect(result.respondents.map((r) => r.name)).toEqual(["Citra Keluar", "Budi Lain", "Anggota Uji"]);
  });

  it("returns member, group, status, who saved and when", async () => {
    const result = await listRespondents(sessionFor(fx.actorId, "USER", fx.leaf), surveyId, { search: "uji" });

    expect(result.respondents).toEqual([
      expect.objectContaining({
        memberId: fx.memberId,
        name: "Anggota Uji",
        groupName: "Leaf",
        memberStatus: "AKTIF",
        recordedByName: "Actor",
        updatedAt: new Date(Date.UTC(2026, 0, 1)),
      }),
    ]);
  });

  it("filters by name search", async () => {
    const result = await listRespondents(sessionFor(fx.actorId, "ADMIN", fx.branch), surveyId, { search: "budi" });

    expect(result.respondents.map((r) => r.memberId)).toEqual([otherLeafMemberId]);
  });

  it("filters by group, including descendants", async () => {
    const session = sessionFor(fx.actorId, "ADMIN", fx.branch);

    const one = await listRespondents(session, surveyId, { groupIds: [fx.otherLeaf.id] });
    expect(one.respondents.map((r) => r.memberId)).toEqual([otherLeafMemberId]);

    const all = await listRespondents(session, surveyId, { groupIds: [fx.branch.id] });
    expect(all.total).toBe(3);
  });

  it("responds NotFound for a group filter outside the caller's scope", async () => {
    const session = sessionFor(fx.actorId, "USER", fx.leaf);

    await expect(listRespondents(session, surveyId, { groupIds: [fx.otherLeaf.id] })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("responds NotFound for a survey outside visibility", async () => {
    const hidden = await db.survey.create({ data: { groupId: fx.otherLeaf.id, createdById: fx.actorId, title: "Lain" } });

    await expect(listRespondents(sessionFor(fx.actorId, "ADMIN", fx.leaf), hidden.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("flags canRecord only for users in the owning group or below", async () => {
    expect((await listRespondents(sessionFor(fx.actorId, "USER", fx.leaf), surveyId)).canRecord).toBe(true);
    expect((await listRespondents(sessionFor(fx.actorId, "ADMIN", fx.branch), surveyId)).canRecord).toBe(true);
    expect((await listRespondents(sessionFor(fx.actorId, "OWNER", fx.root), surveyId)).canRecord).toBe(false);
  });

  it("paginates with PAGE_SIZE", async () => {
    const ids: number[] = [];
    for (let i = 0; i < PAGE_SIZE; i++) {
      ids.push(await member(`Peserta ${i}`, fx.leaf.id));
    }
    for (const id of ids) await respond(id, new Date(Date.UTC(2025, 0, 1)));
    const session = sessionFor(fx.actorId, "ADMIN", fx.branch);

    const first = await listRespondents(session, surveyId, { page: 1 });
    const second = await listRespondents(session, surveyId, { page: 2 });

    expect(first.respondents).toHaveLength(PAGE_SIZE);
    expect(second.respondents).toHaveLength(3);
    expect(first.total).toBe(PAGE_SIZE + 3);
  });
});
