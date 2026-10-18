import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { type PageFixture, buildPageFixture, sessionFor } from "@/lib/test/fixtures";
import { loadSurveyDetail } from "./detail";

describe("lib/survey/detail", () => {
  let fx: PageFixture;
  let surveyId: number;
  let answeredQuestionId: number;
  let answeredOptionId: number;
  let archivedQuestionId: number;

  beforeAll(async () => {
    fx = await buildPageFixture("survey-detail");
    const survey = await db.survey.create({
      data: {
        groupId: fx.branch.id,
        createdById: fx.actorId,
        title: "Kesiapan Ramadhan",
        description: "Survei awal",
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
                  { order: 1, label: "Tidak" },
                  { order: 2, label: "Ragu", archivedAt: new Date() },
                ],
              },
            },
            { order: 1, type: "SCALE", label: "Semangat", helpText: "1 rendah", scaleMin: 1, scaleMax: 5 },
            { order: 2, type: "SHORT_TEXT", label: "Lama", archivedAt: new Date() },
          ],
        },
      },
      include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
    });
    surveyId = survey.id;
    answeredQuestionId = survey.questions[0].id;
    answeredOptionId = survey.questions[0].options.find((o) => o.label === "Ya")!.id;
    archivedQuestionId = survey.questions[2].id;

    const response = await db.surveyResponse.create({
      data: { surveyId, memberId: fx.memberId, recordedById: fx.actorId },
    });
    await db.surveyAnswer.create({
      data: { responseId: response.id, questionId: answeredQuestionId, optionId: answeredOptionId },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns the whole form in builder shape, ids and archived flags included", async () => {
    const detail = await loadSurveyDetail(sessionFor(fx.actorId, "ADMIN", fx.branch), surveyId);

    expect(detail.form.title).toBe("Kesiapan Ramadhan");
    expect(detail.form.description).toBe("Survei awal");
    expect(detail.form.questions.map((q) => [q.type, q.label, q.archived])).toEqual([
      ["SINGLE_CHOICE", "Siap?", false],
      ["SCALE", "Semangat", false],
      ["SHORT_TEXT", "Lama", true],
    ]);
    expect(detail.form.questions[0]).toMatchObject({ id: answeredQuestionId, required: true });
    expect(detail.form.questions[0].options.map((o) => [o.label, o.archived])).toEqual([
      ["Ya", false],
      ["Tidak", false],
      ["Ragu", true],
    ]);
    expect(detail.form.questions[1]).toMatchObject({ helpText: "1 rendah", scaleMin: 1, scaleMax: 5 });
    expect(detail.form.questions[2].id).toBe(archivedQuestionId);
  });

  it("reports which questions and options already have answers", async () => {
    const detail = await loadSurveyDetail(sessionFor(fx.actorId, "ADMIN", fx.branch), surveyId);

    expect(detail.lockedQuestionIds).toEqual([answeredQuestionId]);
    expect(detail.lockedOptionIds).toEqual([answeredOptionId]);
  });

  it("lets only the owner group's admin edit", async () => {
    const owner = await loadSurveyDetail(sessionFor(fx.actorId, "ADMIN", fx.branch), surveyId);
    const user = await loadSurveyDetail(sessionFor(fx.actorId, "USER", fx.branch), surveyId);
    const ancestor = await loadSurveyDetail(sessionFor(fx.actorId, "OWNER", fx.root), surveyId);
    const descendant = await loadSurveyDetail(sessionFor(fx.actorId, "ADMIN", fx.leaf), surveyId);

    expect([owner.canEdit, user.canEdit, ancestor.canEdit, descendant.canEdit]).toEqual([true, false, false, false]);
  });

  it("flags an inherited survey and counts only in-scope responses", async () => {
    const owner = await loadSurveyDetail(sessionFor(fx.actorId, "ADMIN", fx.branch), surveyId);
    const below = await loadSurveyDetail(sessionFor(fx.actorId, "USER", fx.leaf), surveyId);

    expect(owner.inherited).toBe(false);
    expect(owner.responseCount).toBe(1);
    expect(below.inherited).toBe(true);
    expect(below.responseCount).toBe(1);

    const sibling = await loadSurveyDetail(sessionFor(fx.actorId, "USER", fx.otherLeaf), surveyId);
    expect(sibling.responseCount).toBe(0);
  });

  it("throws NotFoundError for a survey outside the caller's reach", async () => {
    const other = await db.survey.create({
      data: { groupId: fx.otherLeaf.id, createdById: fx.actorId, title: "Cabang lain" },
    });
    await expect(loadSurveyDetail(sessionFor(fx.actorId, "ADMIN", fx.leaf), other.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
