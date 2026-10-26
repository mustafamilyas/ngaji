import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EMBEDDED_PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { type FixtureGroup, type PageFixture, buildPageFixture, sessionFor } from "@/lib/test/fixtures";
import { parseSurveyDemographics, surveyStatistics } from "./stats";

describe("lib/survey/stats", () => {
  let fx: PageFixture;
  let surveyId: number;
  let q: { multi: number; scale: number; number: number; text: number; single: number };
  let optA: number;
  let optB: number;
  let optC: number;
  let optDArchived: number;

  // A second subtree of the same org, outside the survey owner's (branch) subtree.
  let outsideBranch: FixtureGroup;
  let outsideLeaf: FixtureGroup;
  let textSurveyId: number;
  let textQuestionId: number;

  const root = () => sessionFor(fx.actorId, "ADMIN", fx.root);
  const branchAdmin = () => sessionFor(fx.actorId, "ADMIN", fx.branch);
  const leafUser = () => sessionFor(fx.actorId, "USER", fx.leaf);

  async function member(
    name: string,
    groupId: number,
    extra: { sex?: string; birthDate?: string; status?: string; deletedAt?: Date; workStatus?: string; maritalStatus?: string } = {},
  ) {
    return (
      await db.member.create({
        data: {
          groupId,
          name,
          birthPlace: "Jakarta",
          birthDate: extra.birthDate ?? "2000-01-01",
          sex: extra.sex ?? "L",
          address: "Jl. Uji No. 3",
          phone: "081200000002",
          maritalStatus: extra.maritalStatus ?? "BELUM_MENIKAH",
          workStatus: extra.workStatus ?? "BEKERJA",
          status: extra.status ?? "AKTIF",
          exitedAt: extra.status && extra.status !== "AKTIF" ? "2026-01-01" : null,
          joinedAt: "2024-01-01",
          createdById: fx.actorId,
          deletedAt: extra.deletedAt,
        },
      })
    ).id;
  }

  async function respond(
    forSurveyId: number,
    memberId: number,
    updatedAt: Date,
    answers: { questionId: number; optionId?: number; numberValue?: number; textValue?: string }[],
  ) {
    await db.surveyResponse.create({
      data: { surveyId: forSurveyId, memberId, recordedById: fx.actorId, updatedAt, answers: { create: answers } },
    });
  }

  async function childGroup(parentId: number, parentPath: string, depth: number, name: string) {
    const row = await db.group.create({
      data: { organizationId: fx.organizationId, parentId, depth, name, path: "" },
    });
    return db.group.update({ where: { id: row.id }, data: { path: `${parentPath}${row.id}/` } });
  }

  beforeAll(async () => {
    fx = await buildPageFixture("survey-stats");
    outsideBranch = await childGroup(fx.root.id, fx.root.path, 1, "Branch Luar");
    outsideLeaf = await childGroup(outsideBranch.id, outsideBranch.path, 2, "Leaf Luar");

    // ---- main survey, owned by `branch` ----
    const survey = await db.survey.create({
      data: {
        groupId: fx.branch.id,
        createdById: fx.actorId,
        title: "Uji Statistik",
        questions: {
          create: [
            {
              order: 1,
              type: "MULTI_CHOICE",
              label: "Pilihan",
              options: {
                create: [
                  { order: 1, label: "A" },
                  { order: 2, label: "B" },
                  { order: 3, label: "C" },
                  { order: 4, label: "D lama", archivedAt: new Date() },
                ],
              },
            },
            { order: 2, type: "SCALE", label: "Skala", scaleMin: 1, scaleMax: 5 },
            { order: 3, type: "NUMBER", label: "Angka" },
            { order: 4, type: "SHORT_TEXT", label: "Catatan" },
            {
              order: 5,
              type: "SINGLE_CHOICE",
              label: "Belum dijawab",
              options: { create: [{ order: 1, label: "Ya" }, { order: 2, label: "Tidak" }] },
            },
          ],
        },
      },
      include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
    });
    surveyId = survey.id;
    const [multi, scale, number, text, single] = survey.questions;
    q = { multi: multi.id, scale: scale.id, number: number.id, text: text.id, single: single.id };
    optA = multi.options.find((o) => o.label === "A")!.id;
    optB = multi.options.find((o) => o.label === "B")!.id;
    optC = multi.options.find((o) => o.label === "C")!.id;
    optDArchived = multi.options.find((o) => o.label === "D lama")!.id;

    // ---- members ----
    const m1 = fx.memberId; // leaf, L, AKTIF
    const m2 = await member("Siti Lansia", fx.leaf.id, { sex: "P", birthDate: "1950-01-01", workStatus: "PENSIUN", maritalStatus: "MENIKAH" });
    const m3 = await member("Tuti", fx.leaf.id, { sex: "P" });
    await member("Umar Belum", fx.leaf.id); // m4, active, no response
    const mLeft = await member("Wawan Keluar", fx.leaf.id, { status: "KELUAR" });
    const mDeleted = await member("Xena Terhapus", fx.leaf.id, { deletedAt: new Date() });
    const k1 = await member("Yusuf Dua", fx.otherLeaf.id);
    await member("Zainab Dua Belum", fx.otherLeaf.id, { sex: "P" }); // k2, no response

    const day = (n: number) => new Date(Date.UTC(2026, 0, n));
    await respond(surveyId, m1, day(1), [
      { questionId: q.multi, optionId: optA },
      { questionId: q.multi, optionId: optB },
      { questionId: q.scale, numberValue: 5 },
      { questionId: q.number, numberValue: 10 },
      { questionId: q.text, textValue: "pertama" },
    ]);
    await respond(surveyId, m2, day(2), [
      { questionId: q.multi, optionId: optA },
      { questionId: q.multi, optionId: optB },
      { questionId: q.scale, numberValue: 5 },
      { questionId: q.number, numberValue: 20 },
      { questionId: q.text, textValue: "kedua" },
    ]);
    await respond(surveyId, m3, day(3), [
      { questionId: q.multi, optionId: optA },
      { questionId: q.scale, numberValue: 3 },
    ]);
    await respond(surveyId, mLeft, day(4), [
      { questionId: q.multi, optionId: optC },
      { questionId: q.multi, optionId: optDArchived },
    ]);
    await respond(surveyId, mDeleted, day(5), [{ questionId: q.multi, optionId: optA }]);
    await respond(surveyId, k1, day(6), [
      { questionId: q.multi, optionId: optA },
      { questionId: q.scale, numberValue: 4 },
    ]);

    // ---- text-pagination survey, owned by an unrelated subtree ----
    const textSurvey = await db.survey.create({
      data: {
        groupId: outsideBranch.id,
        createdById: fx.actorId,
        title: "Uji Teks",
        questions: { create: [{ order: 1, type: "LONG_TEXT", label: "Saran" }] },
      },
      include: { questions: true },
    });
    textSurveyId = textSurvey.id;
    textQuestionId = textSurvey.questions[0].id;
    const total = EMBEDDED_PAGE_SIZE + 2;
    for (let i = 1; i <= total; i++) {
      const id = await member(`Penulis ${String(i).padStart(2, "0")}`, outsideLeaf.id);
      await respond(textSurveyId, id, new Date(Date.UTC(2026, 1, i)), [
        { questionId: textQuestionId, textValue: `saran ${i}` },
      ]);
    }
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  function question(result: Awaited<ReturnType<typeof surveyStatistics>>, id: number) {
    const found = result.questions.find((x) => x.id === id);
    if (!found) throw new Error(`question ${id} missing`);
    return found;
  }

  describe("selected group", () => {
    it("defaults to the owning group for an admin above it", async () => {
      const result = await surveyStatistics(root(), surveyId);
      expect(result.group.id).toBe(fx.branch.id);
    });

    it("defaults to the viewer's own group for a user below the owner and counts only that group", async () => {
      const result = await surveyStatistics(leafUser(), surveyId);
      expect(result.group.id).toBe(fx.leaf.id);
      expect(result.rate.expected).toBe(4);
    });

    it("throws NotFound for a group outside the viewer's scope", async () => {
      await expect(surveyStatistics(leafUser(), surveyId, { groupId: fx.otherLeaf.id })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("shows an empty population for an in-scope group unrelated to the owner", async () => {
      const result = await surveyStatistics(root(), surveyId, { groupId: outsideBranch.id });
      expect(result.rate).toMatchObject({ expected: 0, answered: 0, percent: 0 });
      expect(question(result, q.multi).answeredCount).toBe(0);
      expect(result.nonRespondents.total).toBe(0);
    });

    it("throws NotFound when the survey is outside the viewer's reach", async () => {
      const s = sessionFor(fx.actorId, "ADMIN", outsideLeaf);
      await expect(surveyStatistics(s, surveyId)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("response rate and non-respondents", () => {
    it("counts only active members as expected and answered, leaving out left and deleted members", async () => {
      const result = await surveyStatistics(leafUser(), surveyId);
      expect(result.rate).toEqual({ expected: 4, answered: 3, percent: 75 });
    });

    it("lists active members without a response, never left or deleted ones", async () => {
      const result = await surveyStatistics(leafUser(), surveyId);
      expect(result.nonRespondents.rows.map((r) => r.name)).toEqual(["Umar Belum"]);
    });

    it("searches non-respondents by name", async () => {
      const result = await surveyStatistics(branchAdmin(), surveyId, { search: "dua" });
      expect(result.nonRespondents.rows.map((r) => r.name)).toEqual(["Zainab Dua Belum"]);
      expect(result.nonRespondents.total).toBe(1);
    });

    it("sets canRecord for viewers in the owning group or below and not for viewers above it", async () => {
      expect((await surveyStatistics(leafUser(), surveyId)).canRecord).toBe(true);
      expect((await surveyStatistics(branchAdmin(), surveyId)).canRecord).toBe(true);
      expect((await surveyStatistics(root(), surveyId)).canRecord).toBe(false);
    });
  });

  describe("per-question results", () => {
    it("computes multi-choice counts and percentages over the question's answered count", async () => {
      const result = await surveyStatistics(leafUser(), surveyId);
      const multi = question(result, q.multi);
      expect(multi.type).toBe("MULTI_CHOICE");
      if (multi.type !== "MULTI_CHOICE") return;
      // answered: m1, m2, m3, Wawan (left, still counted); deleted member and K2 excluded
      expect(multi.answeredCount).toBe(4);
      const byLabel = Object.fromEntries(multi.options.map((o) => [o.label, o]));
      expect(byLabel["A"]).toMatchObject({ count: 3, percent: 75 });
      expect(byLabel["B"]).toMatchObject({ count: 2, percent: 50 });
      expect(byLabel["C"]).toMatchObject({ count: 1, percent: 25 });
    });

    it("keeps archived options, marked, in the results", async () => {
      const multi = question(await surveyStatistics(leafUser(), surveyId), q.multi);
      if (multi.type !== "MULTI_CHOICE") throw new Error("type");
      expect(multi.options.find((o) => o.label === "D lama")).toMatchObject({ archived: true, count: 1 });
    });

    it("counts a left member's answers in per-question results but not in expected or answered", async () => {
      const result = await surveyStatistics(leafUser(), surveyId);
      const multi = question(result, q.multi);
      expect(multi.answeredCount).toBe(4);
      expect(result.rate.answered).toBe(3);
    });

    it("shows scale counts for every value including zeros, with the average", async () => {
      const scale = question(await surveyStatistics(leafUser(), surveyId), q.scale);
      if (scale.type !== "SCALE") throw new Error("type");
      expect(scale.answeredCount).toBe(3);
      expect(scale.distribution.map((d) => d.value)).toEqual([1, 2, 3, 4, 5]);
      expect(scale.distribution.find((d) => d.value === 2)?.count).toBe(0);
      expect(scale.distribution.find((d) => d.value === 5)?.count).toBe(2);
      expect(scale.average).toBeCloseTo(13 / 3);
    });

    it("computes average, minimum and maximum for number questions", async () => {
      const num = question(await surveyStatistics(leafUser(), surveyId), q.number);
      if (num.type !== "NUMBER") throw new Error("type");
      expect(num).toMatchObject({ answeredCount: 2, average: 15, min: 10, max: 20 });
    });

    it("lists text answers newest first with the member name", async () => {
      const text = question(await surveyStatistics(leafUser(), surveyId), q.text);
      if (text.type !== "SHORT_TEXT") throw new Error("type");
      expect(text.answeredCount).toBe(2);
      expect(text.answers.map((a) => [a.memberName, a.text])).toEqual([
        ["Siti Lansia", "kedua"],
        ["Anggota Uji", "pertama"],
      ]);
    });

    it("reports no answers for a question nobody answered", async () => {
      const single = question(await surveyStatistics(leafUser(), surveyId), q.single);
      expect(single.answeredCount).toBe(0);
      if (single.type !== "SINGLE_CHOICE") throw new Error("type");
      expect(single.options.every((o) => o.count === 0 && o.percent === 0)).toBe(true);
    });

    it("includes sibling answers for an admin of the owner, but not for a kelompok user", async () => {
      const admin = question(await surveyStatistics(branchAdmin(), surveyId), q.multi);
      const user = question(await surveyStatistics(leafUser(), surveyId), q.multi);
      if (admin.type !== "MULTI_CHOICE" || user.type !== "MULTI_CHOICE") throw new Error("type");
      expect(admin.options.find((o) => o.label === "A")?.count).toBe(4); // m1, m2, m3, K2's Yusuf
      expect(user.options.find((o) => o.label === "A")?.count).toBe(3);
    });
  });

  describe("text pagination", () => {
    it("returns the first page by default and the requested page for the chosen question", async () => {
      const first = await surveyStatistics(root(), textSurveyId);
      const firstText = question(first, textQuestionId);
      if (firstText.type !== "LONG_TEXT") throw new Error("type");
      expect(firstText.answers).toHaveLength(EMBEDDED_PAGE_SIZE);
      expect(firstText.total).toBe(EMBEDDED_PAGE_SIZE + 2);
      expect(firstText.answers[0].text).toBe(`saran ${EMBEDDED_PAGE_SIZE + 2}`);

      const second = await surveyStatistics(root(), textSurveyId, { text: { questionId: textQuestionId, page: 2 } });
      const secondText = question(second, textQuestionId);
      if (secondText.type !== "LONG_TEXT") throw new Error("type");
      expect(secondText.page).toBe(2);
      expect(secondText.answers.map((a) => a.text)).toEqual(["saran 2", "saran 1"]);
    });
  });

  describe("breakdown per direct sub-group", () => {
    it("gives each direct child its own rate and per-option counts", async () => {
      const result = await surveyStatistics(branchAdmin(), surveyId);
      expect(result.breakdown).not.toBeNull();
      const rows = result.breakdown!;
      const k1 = rows.find((r) => r.groupId === fx.leaf.id)!;
      const k2 = rows.find((r) => r.groupId === fx.otherLeaf.id)!;
      expect(k1.rate).toEqual({ expected: 4, answered: 3, percent: 75 });
      expect(k2.rate).toEqual({ expected: 2, answered: 1, percent: 50 });
      const k1Multi = k1.questions.find((x) => x.questionId === q.multi)!;
      const k2Multi = k2.questions.find((x) => x.questionId === q.multi)!;
      if (k1Multi.type !== "MULTI_CHOICE" || k2Multi.type !== "MULTI_CHOICE") throw new Error("type");
      expect(k1Multi.options.find((o) => o.label === "A")?.count).toBe(3);
      expect(k2Multi.options.find((o) => o.label === "A")?.count).toBe(1);
    });

    it("includes per-value counts of scale questions per child", async () => {
      const rows = (await surveyStatistics(branchAdmin(), surveyId)).breakdown!;
      const k2 = rows.find((r) => r.groupId === fx.otherLeaf.id)!;
      const scale = k2.questions.find((x) => x.questionId === q.scale)!;
      if (scale.type !== "SCALE") throw new Error("type");
      expect(scale.distribution.find((d) => d.value === 4)?.count).toBe(1);
    });

    it("omits text and number questions from the breakdown", async () => {
      const rows = (await surveyStatistics(branchAdmin(), surveyId)).breakdown!;
      const ids = rows[0].questions.map((x) => x.questionId);
      expect(ids).toEqual([q.multi, q.scale, q.single]);
    });

    it("is null for a leaf group", async () => {
      expect((await surveyStatistics(leafUser(), surveyId)).breakdown).toBeNull();
    });

    it("drops children that do not intersect the owner's subtree", async () => {
      const result = await surveyStatistics(root(), surveyId, { groupId: fx.root.id });
      expect(result.breakdown!.map((r) => r.groupId)).toEqual([fx.branch.id]);
    });
  });

  describe("demographic filters", () => {
    it("narrows every figure to the chosen sex", async () => {
      const result = await surveyStatistics(branchAdmin(), surveyId, { demographics: { sex: "P" } });
      // active women: Siti, Tuti (answered) and Zainab (not answered)
      expect(result.rate).toEqual({ expected: 3, answered: 2, percent: 66.7 });
      expect(question(result, q.scale).answeredCount).toBe(2);
      expect(result.nonRespondents.rows.map((r) => r.name)).toEqual(["Zainab Dua Belum"]);
      expect(result.breakdown!.find((r) => r.groupId === fx.leaf.id)?.rate.expected).toBe(2);
    });

    it("narrows to an age bracket computed from birth date", async () => {
      const result = await surveyStatistics(leafUser(), surveyId, { demographics: { ageBracket: "lansia" } });
      expect(result.rate).toEqual({ expected: 1, answered: 1, percent: 100 });
    });

    it("narrows by work status and marital status", async () => {
      const work = await surveyStatistics(leafUser(), surveyId, { demographics: { workStatus: "PENSIUN" } });
      expect(work.rate.expected).toBe(1);
      const marital = await surveyStatistics(leafUser(), surveyId, { demographics: { maritalStatus: "MENIKAH" } });
      expect(marital.rate.expected).toBe(1);
    });
  });

  describe("parseSurveyDemographics", () => {
    it("keeps valid values", () => {
      expect(parseSurveyDemographics({ jk: "P", umur: "lansia", kerja: "PENSIUN", nikah: "MENIKAH" })).toEqual({
        sex: "P",
        ageBracket: "lansia",
        workStatus: "PENSIUN",
        maritalStatus: "MENIKAH",
      });
    });

    it("ignores invalid and empty values", () => {
      expect(parseSurveyDemographics({ jk: "X", umur: "kakek", kerja: "", nikah: "???" })).toEqual({});
      expect(parseSurveyDemographics({})).toEqual({});
    });
  });
});
