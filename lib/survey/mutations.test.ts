import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { type PageFixture, buildPageFixture, sessionFor } from "@/lib/test/fixtures";
import type { SurveyFormInput } from "@/lib/validation/survey";
import { surveyFormSchema } from "@/lib/validation/survey";
import { createSurvey, deleteSurvey, updateSurvey } from "./mutations";

const auditControl = vi.hoisted(() => ({ fail: false }));

vi.mock("@/lib/audit", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/audit")>();
  return {
    ...original,
    audit: async (...args: Parameters<typeof original.audit>) => {
      if (auditControl.fail) throw new Error("audit failed");
      return original.audit(...args);
    },
  };
});

function form(input: SurveyFormInput) {
  return surveyFormSchema.parse(input);
}

const baseForm: SurveyFormInput = {
  title: "Kesiapan Ramadhan",
  description: "Survei awal",
  questions: [
    { type: "SINGLE_CHOICE", label: "Siap?", required: true, options: [{ label: "Ya" }, { label: "Tidak" }] },
    { type: "SCALE", label: "Semangat", required: false, options: [] },
    { type: "SHORT_TEXT", label: "Catatan", required: false, options: [] },
  ],
};

async function loadForm(surveyId: number) {
  return db.surveyQuestion.findMany({
    where: { surveyId },
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } } },
  });
}

/** Stored form as the builder would resubmit it (ids included). */
async function currentInput(surveyId: number): Promise<SurveyFormInput> {
  const survey = await db.survey.findUniqueOrThrow({ where: { id: surveyId } });
  const questions = await loadForm(surveyId);
  return {
    title: survey.title,
    description: survey.description ?? undefined,
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type as SurveyFormInput["questions"][number]["type"],
      label: q.label,
      helpText: q.helpText ?? undefined,
      required: q.required,
      scaleMin: q.scaleMin ?? undefined,
      scaleMax: q.scaleMax ?? undefined,
      archived: q.archivedAt !== null,
      options: q.options.map((o) => ({ id: o.id, label: o.label, archived: o.archivedAt !== null })),
    })),
  };
}

describe("lib/survey/mutations", () => {
  let fx: PageFixture;

  beforeAll(async () => {
    fx = await buildPageFixture("survey-mutations");
  });

  beforeEach(() => {
    auditControl.fail = false;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function answer(surveyId: number, questionId: number, optionId?: number) {
    const response = await db.surveyResponse.upsert({
      where: { surveyId_memberId: { surveyId, memberId: fx.memberId } },
      create: { surveyId, memberId: fx.memberId, recordedById: fx.actorId },
      update: {},
    });
    await db.surveyAnswer.create({ data: { responseId: response.id, questionId, optionId: optionId ?? null } });
  }

  describe("createSurvey", () => {
    it("creates the survey in the caller's own group with ordered questions/options and audits it", async () => {
      const session = sessionFor(fx.actorId, "ADMIN", fx.branch);
      const survey = await createSurvey(session, form(baseForm));

      expect(survey.groupId).toBe(fx.branch.id);
      expect(survey.createdById).toBe(fx.actorId);

      const questions = await loadForm(survey.id);
      expect(questions.map((q) => [q.order, q.type, q.label])).toEqual([
        [0, "SINGLE_CHOICE", "Siap?"],
        [1, "SCALE", "Semangat"],
        [2, "SHORT_TEXT", "Catatan"],
      ]);
      expect(questions[0].options.map((o) => [o.order, o.label])).toEqual([
        [0, "Ya"],
        [1, "Tidak"],
      ]);
      expect([questions[1].scaleMin, questions[1].scaleMax]).toEqual([1, 5]);

      const entry = await db.auditLog.findFirst({ where: { action: "survey.create", entityId: survey.id } });
      expect(entry).toMatchObject({ actorId: fx.actorId, entity: "Survey", groupId: fx.branch.id });
      expect(entry?.after).toMatchObject({
        title: "Kesiapan Ramadhan",
        questions: [{ label: "Siap?", options: [{ label: "Ya" }, { label: "Tidak" }] }, {}, {}],
      });
    });

    it("throws ForbiddenError for a USER and writes nothing", async () => {
      const session = sessionFor(fx.actorId, "USER", fx.branch);
      const before = await db.survey.count();

      await expect(createSurvey(session, form({ ...baseForm, title: "Oleh USER" }))).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(await db.survey.count()).toBe(before);
    });

    it("rolls back when the audit insert fails", async () => {
      const session = sessionFor(fx.actorId, "ADMIN", fx.branch);
      auditControl.fail = true;

      await expect(createSurvey(session, form({ ...baseForm, title: "Rollback Create" }))).rejects.toThrow(
        "audit failed",
      );
      expect(await db.survey.count({ where: { title: "Rollback Create" } })).toBe(0);
    });
  });

  describe("updateSurvey", () => {
    it("lets the owner admin rename a question and audits before/after", async () => {
      const session = sessionFor(fx.actorId, "ADMIN", fx.branch);
      const survey = await createSurvey(session, form(baseForm));
      const input = await currentInput(survey.id);
      input.questions[0].label = "Sudah siap?";

      await updateSurvey(session, survey.id, form(input));

      const questions = await loadForm(survey.id);
      expect(questions[0].label).toBe("Sudah siap?");
      const entry = await db.auditLog.findFirst({ where: { action: "survey.update", entityId: survey.id } });
      expect(entry).toMatchObject({ entity: "Survey", groupId: fx.branch.id });
      expect(entry?.before).toMatchObject({ questions: [{ label: "Siap?" }, {}, {}] });
      expect(entry?.after).toMatchObject({ questions: [{ label: "Sudah siap?" }, {}, {}] });
    });

    it("throws ForbiddenError for a root OWNER (ancestor) and writes nothing", async () => {
      const survey = await createSurvey(sessionFor(fx.actorId, "ADMIN", fx.branch), form(baseForm));
      const input = await currentInput(survey.id);
      input.title = "Diubah root";

      await expect(
        updateSurvey(sessionFor(fx.actorId, "OWNER", fx.root), survey.id, form(input)),
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect((await db.survey.findUniqueOrThrow({ where: { id: survey.id } })).title).toBe("Kesiapan Ramadhan");
    });

    it("throws ForbiddenError for a descendant admin", async () => {
      const survey = await createSurvey(sessionFor(fx.actorId, "ADMIN", fx.branch), form(baseForm));
      const input = await currentInput(survey.id);

      await expect(
        updateSurvey(sessionFor(fx.actorId, "ADMIN", fx.leaf), survey.id, form(input)),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("throws NotFoundError for a survey in another branch", async () => {
      const survey = await createSurvey(sessionFor(fx.actorId, "ADMIN", fx.leaf), form(baseForm));
      const input = await currentInput(survey.id);

      await expect(
        updateSurvey(sessionFor(fx.actorId, "ADMIN", fx.otherLeaf), survey.id, form(input)),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("allows a type change before the first answer", async () => {
      const session = sessionFor(fx.actorId, "ADMIN", fx.branch);
      const survey = await createSurvey(session, form(baseForm));
      const input = await currentInput(survey.id);
      input.questions[0] = { ...input.questions[0], type: "LONG_TEXT", options: [] };

      await updateSurvey(session, survey.id, form(input));

      const questions = await loadForm(survey.id);
      expect(questions[0].type).toBe("LONG_TEXT");
      expect(questions[0].options).toEqual([]);
    });

    it("rejects a type change on an answered question and writes nothing", async () => {
      const session = sessionFor(fx.actorId, "ADMIN", fx.branch);
      const survey = await createSurvey(session, form(baseForm));
      const [choice] = await loadForm(survey.id);
      await answer(survey.id, choice.id, choice.options[0].id);
      const input = await currentInput(survey.id);
      input.title = "Judul baru";
      input.questions[0] = { ...input.questions[0], type: "SHORT_TEXT", options: [] };

      await expect(updateSurvey(session, survey.id, form(input))).rejects.toBeInstanceOf(ValidationError);

      expect((await db.survey.findUniqueOrThrow({ where: { id: survey.id } })).title).toBe("Kesiapan Ramadhan");
      expect((await loadForm(survey.id))[0].type).toBe("SINGLE_CHOICE");
    });

    it("archives a removed answered option and deletes a removed unanswered one", async () => {
      const session = sessionFor(fx.actorId, "ADMIN", fx.branch);
      const survey = await createSurvey(
        session,
        form({
          ...baseForm,
          questions: [
            {
              type: "MULTI_CHOICE",
              label: "Bisa bantu apa?",
              required: false,
              options: [{ label: "Konsumsi" }, { label: "Dekorasi" }, { label: "Parkir" }],
            },
          ],
        }),
      );
      const [question] = await loadForm(survey.id);
      const [konsumsi, dekorasi, parkir] = question.options;
      await answer(survey.id, question.id, konsumsi.id);
      const input = await currentInput(survey.id);
      input.questions[0].options = input.questions[0].options.filter((o) => o.id === dekorasi.id);
      input.questions[0].options.push({ label: "Kebersihan" });

      await updateSurvey(session, survey.id, form(input));

      const options = await db.surveyOption.findMany({ where: { questionId: question.id }, orderBy: { id: "asc" } });
      expect(options.find((o) => o.id === konsumsi.id)?.archivedAt).not.toBeNull();
      expect(options.find((o) => o.id === parkir.id)).toBeUndefined();
      expect(options.filter((o) => o.archivedAt === null).map((o) => [o.label, o.order])).toEqual([
        ["Dekorasi", 0],
        ["Kebersihan", 1],
      ]);
    });

    it("archives a removed answered question, deletes a removed unanswered one, and can restore", async () => {
      const session = sessionFor(fx.actorId, "ADMIN", fx.branch);
      const survey = await createSurvey(session, form(baseForm));
      const [choice, scale, text] = await loadForm(survey.id);
      await answer(survey.id, choice.id, choice.options[0].id);
      const input = await currentInput(survey.id);
      input.questions = input.questions.filter((q) => q.id === text.id);

      await updateSurvey(session, survey.id, form(input));

      const afterRemove = await db.surveyQuestion.findMany({ where: { surveyId: survey.id } });
      expect(afterRemove.find((q) => q.id === choice.id)?.archivedAt).not.toBeNull();
      expect(afterRemove.find((q) => q.id === scale.id)).toBeUndefined();

      const restore = await currentInput(survey.id);
      const archived = restore.questions.find((q) => q.id === choice.id);
      if (!archived) throw new Error("archived question missing");
      archived.archived = false;
      await updateSurvey(session, survey.id, form(restore));

      const restored = await db.surveyQuestion.findUniqueOrThrow({ where: { id: choice.id } });
      expect(restored.archivedAt).toBeNull();
    });

    it("adds a new question to a survey that already has responses", async () => {
      const session = sessionFor(fx.actorId, "ADMIN", fx.branch);
      const survey = await createSurvey(session, form(baseForm));
      const [choice] = await loadForm(survey.id);
      await answer(survey.id, choice.id, choice.options[0].id);
      const input = await currentInput(survey.id);
      input.questions.push({ type: "NUMBER", label: "Jumlah keluarga", required: false, options: [] });

      await updateSurvey(session, survey.id, form(input));

      const questions = await loadForm(survey.id);
      expect(questions.map((q) => q.label)).toEqual(["Siap?", "Semangat", "Catatan", "Jumlah keluarga"]);
    });

    it("rolls back when the audit insert fails", async () => {
      const session = sessionFor(fx.actorId, "ADMIN", fx.branch);
      const survey = await createSurvey(session, form(baseForm));
      const input = await currentInput(survey.id);
      input.title = "Rollback Update";
      input.questions = input.questions.slice(0, 1);

      auditControl.fail = true;
      await expect(updateSurvey(session, survey.id, form(input))).rejects.toThrow("audit failed");

      expect((await db.survey.findUniqueOrThrow({ where: { id: survey.id } })).title).toBe("Kesiapan Ramadhan");
      expect(await loadForm(survey.id)).toHaveLength(3);
    });
  });

  describe("deleteSurvey", () => {
    it("soft-deletes the survey, keeps its responses and audits it", async () => {
      const session = sessionFor(fx.actorId, "ADMIN", fx.branch);
      const survey = await createSurvey(session, form(baseForm));
      const [choice] = await loadForm(survey.id);
      await answer(survey.id, choice.id, choice.options[0].id);

      await deleteSurvey(session, survey.id);

      expect(await db.survey.findUnique({ where: { id: survey.id } })).toBeNull();
      expect(await db.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(1);
      const entry = await db.auditLog.findFirst({ where: { action: "survey.delete", entityId: survey.id } });
      expect(entry).toMatchObject({ entity: "Survey", groupId: fx.branch.id });
      expect(entry?.before).toMatchObject({ title: "Kesiapan Ramadhan" });
    });

    it("throws ForbiddenError for a USER of the owning group", async () => {
      const survey = await createSurvey(sessionFor(fx.actorId, "ADMIN", fx.branch), form(baseForm));

      await expect(deleteSurvey(sessionFor(fx.actorId, "USER", fx.branch), survey.id)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(await db.survey.findUnique({ where: { id: survey.id } })).not.toBeNull();
    });
  });
});
