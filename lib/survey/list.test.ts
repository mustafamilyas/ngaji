import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { type PageFixture, buildPageFixture, sessionFor } from "@/lib/test/fixtures";
import { listSurveys } from "./list";

describe("lib/survey/list", () => {
  let fx: PageFixture;
  let otherMemberId: number;
  const ids: Record<string, number> = {};

  async function survey(key: string, groupId: number, title: string, extra: { deletedAt?: Date; createdAt?: Date } = {}) {
    const row = await db.survey.create({ data: { groupId, title, createdById: fx.actorId, ...extra } });
    ids[key] = row.id;
    return row;
  }

  async function respond(surveyId: number, memberId: number) {
    await db.surveyResponse.create({ data: { surveyId, memberId, recordedById: fx.actorId } });
  }

  beforeAll(async () => {
    fx = await buildPageFixture("survey-list");

    const member = async (name: string, groupId: number, deletedAt: Date | null = null) =>
      (
        await db.member.create({
          data: {
            groupId,
            name,
            birthPlace: "Jakarta",
            birthDate: "2000-01-01",
            sex: "P",
            address: "Jl. Uji No. 2",
            phone: "081200000001",
            maritalStatus: "BELUM_MENIKAH",
            workStatus: "BEKERJA",
            status: "AKTIF",
            joinedAt: "2024-01-01",
            createdById: fx.actorId,
            deletedAt,
          },
        })
      ).id;
    otherMemberId = await member("Anggota Lain", fx.otherLeaf.id);
    const deletedMemberId = await member("Anggota Terhapus", fx.leaf.id, new Date());

    const day = (n: number) => new Date(Date.UTC(2026, 0, n));
    await survey("root", fx.root.id, "Survei Pusat", { createdAt: day(1) });
    await survey("branch", fx.branch.id, "Kesiapan Ramadhan", { createdAt: day(2) });
    await survey("leaf", fx.leaf.id, "Survei Kelompok", { createdAt: day(3) });
    await survey("otherLeaf", fx.otherLeaf.id, "Survei Kelompok Lain", { createdAt: day(4) });
    await survey("deleted", fx.branch.id, "Survei Terhapus", { createdAt: day(5), deletedAt: new Date() });

    await respond(ids.branch, fx.memberId);
    await respond(ids.branch, otherMemberId);
    await respond(ids.branch, deletedMemberId);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("lists ancestor, own and descendant surveys, newest first, never other branches or deleted ones", async () => {
    const { surveys } = await listSurveys(sessionFor(fx.actorId, "USER", fx.leaf));

    expect(surveys.map((s) => s.id)).toEqual([ids.leaf, ids.branch, ids.root]);
  });

  it("includes every survey in the caller's subtree for a group higher up", async () => {
    const { surveys, total } = await listSurveys(sessionFor(fx.actorId, "ADMIN", fx.branch));

    expect(surveys.map((s) => s.id)).toEqual([ids.otherLeaf, ids.leaf, ids.branch, ids.root]);
    expect(total).toBe(4);
  });

  it("marks surveys owned above the caller's group as inherited", async () => {
    const { surveys } = await listSurveys(sessionFor(fx.actorId, "USER", fx.leaf));
    const inherited = Object.fromEntries(surveys.map((s) => [s.id, s.inherited]));

    expect(inherited).toEqual({ [ids.root]: true, [ids.branch]: true, [ids.leaf]: false });
  });

  it("returns the owning group's id and name", async () => {
    const { surveys } = await listSurveys(sessionFor(fx.actorId, "USER", fx.leaf));

    expect(surveys.find((s) => s.id === ids.branch)?.group).toEqual({ id: fx.branch.id, name: "Branch" });
  });

  it("searches titles case-insensitively", async () => {
    const { surveys } = await listSurveys(sessionFor(fx.actorId, "ADMIN", fx.branch), { search: "RAMADHAN" });

    expect(surveys.map((s) => s.id)).toEqual([ids.branch]);
  });

  it("filters to surveys that apply to a selected group: its ancestors, itself and its descendants", async () => {
    const { surveys } = await listSurveys(sessionFor(fx.actorId, "ADMIN", fx.branch), { groupIds: [fx.leaf.id] });

    expect(surveys.map((s) => s.id)).toEqual([ids.leaf, ids.branch, ids.root]);
  });

  it("unions several selected groups", async () => {
    const { surveys } = await listSurveys(sessionFor(fx.actorId, "ADMIN", fx.branch), {
      groupIds: [fx.leaf.id, fx.otherLeaf.id],
    });

    expect(surveys.map((s) => s.id)).toEqual([ids.otherLeaf, ids.leaf, ids.branch, ids.root]);
  });

  it("throws NotFoundError when a selected group is outside the caller's scope", async () => {
    await expect(
      listSurveys(sessionFor(fx.actorId, "USER", fx.leaf), { groupIds: [fx.otherLeaf.id] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("counts only responses of non-deleted members in the caller's scope", async () => {
    const leafView = await listSurveys(sessionFor(fx.actorId, "USER", fx.leaf));
    const branchView = await listSurveys(sessionFor(fx.actorId, "ADMIN", fx.branch));

    expect(leafView.surveys.find((s) => s.id === ids.branch)?.responseCount).toBe(1);
    expect(branchView.surveys.find((s) => s.id === ids.branch)?.responseCount).toBe(2);
    expect(branchView.surveys.find((s) => s.id === ids.root)?.responseCount).toBe(0);
  });

  it("paginates with PAGE_SIZE and clamps an out-of-range page to the last one", async () => {
    const extraRow = await db.group.create({
      data: { organizationId: fx.organizationId, parentId: fx.branch.id, depth: 2, name: "Paged", path: "" },
    });
    const paged = await db.group.update({ where: { id: extraRow.id }, data: { path: `${fx.branch.path}${extraRow.id}/` } });
    await db.survey.createMany({
      data: Array.from({ length: PAGE_SIZE }, (_, i) => ({ groupId: paged.id, title: `Halaman ${i}`, createdById: fx.actorId })),
    });

    // PAGE_SIZE own surveys + 2 inherited (root, branch) = one full page and 2 on the second.
    const session = sessionFor(fx.actorId, "ADMIN", paged);
    const first = await listSurveys(session);
    const last = await listSurveys(session, { page: 99 });

    expect(first.surveys).toHaveLength(PAGE_SIZE);
    expect(first.total).toBe(PAGE_SIZE + 2);
    expect(last.page).toBe(2);
    expect(last.surveys.map((s) => s.id)).toEqual([ids.branch, ids.root]);
  });
});
