import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { type PageFixture, buildPageFixture, sessionFor } from "@/lib/test/fixtures";
import { loadSurveyEntry } from "./entry";

describe("lib/survey/entry", () => {
  let fx: PageFixture;
  let surveyId: number;
  let choiceId: number;
  let archivedOptionId: number;
  let archivedQuestionId: number;
  let scaleId: number;
  let extraMemberId: number;
  let leftMemberId: number;
  let otherLeafMemberId: number;

  beforeAll(async () => {
    fx = await buildPageFixture("survey-entry");
    const base = {
      birthPlace: "Jakarta",
      birthDate: "2000-01-01",
      sex: "L",
      address: "Jl. Uji",
      phone: "0812",
      maritalStatus: "BELUM_MENIKAH",
      workStatus: "BEKERJA",
      joinedAt: "2024-01-01",
      createdById: fx.actorId,
    };
    extraMemberId = (await db.member.create({ data: { ...base, groupId: fx.leaf.id, name: "Budi", status: "AKTIF" } })).id;
    leftMemberId = (await db.member.create({ data: { ...base, groupId: fx.leaf.id, name: "Keluar", status: "KELUAR" } })).id;
    otherLeafMemberId = (
      await db.member.create({ data: { ...base, groupId: fx.otherLeaf.id, name: "Cabang Lain", status: "AKTIF" } })
    ).id;

    const survey = await db.survey.create({
      data: {
        groupId: fx.branch.id,
        createdById: fx.actorId,
        title: "Kesiapan",
        questions: {
          create: [
            {
              order: 0,
              type: "SINGLE_CHOICE",
              label: "Siap?",
              required: true,
              options: {
                create: [
                  { order: 0, label: "Ya" },
                  { order: 1, label: "Ragu", archivedAt: new Date() },
                  { order: 2, label: "Tidak" },
                ],
              },
            },
            { order: 1, type: "SCALE", label: "Semangat", scaleMin: 1, scaleMax: 5 },
            { order: 2, type: "SHORT_TEXT", label: "Lama", archivedAt: new Date() },
            { order: 3, type: "SHORT_TEXT", label: "Lama tanpa jawaban", archivedAt: new Date() },
          ],
        },
      },
      include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
    });
    surveyId = survey.id;
    choiceId = survey.questions[0].id;
    archivedOptionId = survey.questions[0].options.find((o) => o.label === "Ragu")!.id;
    scaleId = survey.questions[1].id;
    archivedQuestionId = survey.questions[2].id;

    // fx.member answered everything, including a since-archived option and question.
    const response = await db.surveyResponse.create({
      data: { surveyId, memberId: fx.memberId, recordedById: fx.actorId },
    });
    await db.surveyAnswer.createMany({
      data: [
        { responseId: response.id, questionId: choiceId, optionId: archivedOptionId },
        { responseId: response.id, questionId: scaleId, numberValue: 4 },
        { responseId: response.id, questionId: archivedQuestionId, textValue: "jawaban lama" },
      ],
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const userInLeaf = () => sessionFor(fx.actorId, "USER", fx.leaf);

  it("lists active leaf members in scope, flagging who already responded", async () => {
    const entry = await loadSurveyEntry(sessionFor(fx.actorId, "ADMIN", fx.branch), surveyId);

    expect(entry.members.map((m) => [m.name, m.groupName, m.hasResponse])).toEqual([
      ["Anggota Uji", "Leaf", true],
      ["Budi", "Leaf", false],
      ["Cabang Lain", "Other Leaf", false],
    ]);
    expect(entry.members.some((m) => m.id === leftMemberId)).toBe(false);
  });

  it("limits members to the caller's own scope", async () => {
    const entry = await loadSurveyEntry(userInLeaf(), surveyId);

    expect(entry.members.map((m) => m.name)).toEqual(["Anggota Uji", "Budi"]);
  });

  it("hides questions archived without answers and archived options nobody picked", async () => {
    const entry = await loadSurveyEntry(userInLeaf(), surveyId, extraMemberId);

    expect(entry.questions.map((q) => q.label)).toEqual(["Siap?", "Semangat"]);
    expect(entry.questions[0].options.map((o) => o.label)).toEqual(["Ya", "Tidak"]);
    expect(entry.answers).toEqual([]);
  });

  it("prefills an existing response and keeps archived questions/options that hold its answers", async () => {
    const entry = await loadSurveyEntry(userInLeaf(), surveyId, fx.memberId);

    expect(entry.selectedMemberId).toBe(fx.memberId);
    expect(entry.questions.map((q) => [q.label, q.archived])).toEqual([
      ["Siap?", false],
      ["Semangat", false],
      ["Lama", true],
    ]);
    expect(entry.questions[0].options.map((o) => [o.label, o.archived])).toEqual([
      ["Ya", false],
      ["Ragu", true],
      ["Tidak", false],
    ]);
    expect(entry.answers).toEqual(
      expect.arrayContaining([
        { questionId: choiceId, optionIds: [archivedOptionId] },
        { questionId: scaleId, number: 4 },
        { questionId: archivedQuestionId, text: "jawaban lama" },
      ]),
    );
    expect(entry.answers).toHaveLength(3);
  });

  it.each([
    ["an inactive member", () => leftMemberId],
    ["a member outside the caller's scope", () => otherLeafMemberId],
    ["an unknown member", () => 999_999],
  ])("ignores a preselected id for %s", async (_label, id) => {
    const entry = await loadSurveyEntry(userInLeaf(), surveyId, id());

    expect(entry.selectedMemberId).toBeUndefined();
    expect(entry.answers).toEqual([]);
  });

  it("says a user above the owning group cannot record", async () => {
    const entry = await loadSurveyEntry(sessionFor(fx.actorId, "OWNER", fx.root), surveyId);

    expect(entry.canRecord).toBe(false);
    expect(entry.members).toEqual([]);
  });

  it("allows recording from the owning group and below", async () => {
    expect((await loadSurveyEntry(userInLeaf(), surveyId)).canRecord).toBe(true);
    expect((await loadSurveyEntry(sessionFor(fx.actorId, "ADMIN", fx.branch), surveyId)).canRecord).toBe(true);
  });

  it("responds 404 for a survey outside visibility", async () => {
    const other = await db.survey.create({
      data: { groupId: fx.otherLeaf.id, createdById: fx.actorId, title: "Cabang lain" },
    });

    await expect(loadSurveyEntry(userInLeaf(), other.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
