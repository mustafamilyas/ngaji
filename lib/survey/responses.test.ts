import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { type PageFixture, buildPageFixture, sessionFor } from "@/lib/test/fixtures";
import { surveyFormSchema } from "@/lib/validation/survey";
import { createSurvey, updateSurvey } from "./mutations";
import { deleteResponse, saveResponse } from "./responses";

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

describe("lib/survey/responses", () => {
  let fx: PageFixture;
  let surveyId: number;
  let q: { choice: number; yes: number; no: number; text: number; opt: number };

  const adminBranch = () => sessionFor(fx.actorId, "ADMIN", fx.branch);
  const userLeaf = () => sessionFor(fx.actorId, "USER", fx.leaf);
  const ownerRoot = () => sessionFor(fx.actorId, "OWNER", fx.root);

  async function newMember(groupId: number, status = "AKTIF") {
    return db.member.create({
      data: {
        groupId,
        name: `M ${Math.random()}`,
        birthPlace: "X",
        birthDate: "2000-01-01",
        sex: "L",
        address: "-",
        phone: "0",
        maritalStatus: "BELUM_MENIKAH",
        workStatus: "BEKERJA",
        status,
        joinedAt: "2024-01-01",
        createdById: fx.actorId,
      },
    });
  }

  const answerRows = (memberId: number) =>
    db.surveyAnswer.findMany({
      where: { response: { surveyId, memberId } },
      orderBy: { id: "asc" },
    });

  beforeAll(async () => {
    fx = await buildPageFixture("survey-responses");
    const survey = await createSurvey(
      adminBranch(),
      surveyFormSchema.parse({
        title: "Uji Respons",
        questions: [
          { type: "SINGLE_CHOICE", label: "Siap?", required: true, options: [{ label: "Ya" }, { label: "Tidak" }] },
          { type: "SHORT_TEXT", label: "Catatan", required: false, options: [] },
        ],
      }),
    );
    surveyId = survey.id;
    const questions = await db.surveyQuestion.findMany({
      where: { surveyId },
      orderBy: { order: "asc" },
      include: { options: { orderBy: { order: "asc" } } },
    });
    q = {
      choice: questions[0].id,
      yes: questions[0].options[0].id,
      no: questions[0].options[1].id,
      text: questions[1].id,
      opt: 0,
    };
  });

  beforeEach(() => {
    auditControl.fail = false;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const save = (session: ReturnType<typeof userLeaf>, memberId: number, answers: Parameters<typeof saveResponse>[1]["answers"]) =>
    saveResponse(session, { surveyId, memberId, answers });

  it("lets a kelompok USER record for an own member and audits it", async () => {
    const m = await newMember(fx.leaf.id);
    await save(userLeaf(), m.id, [{ questionId: q.choice, optionIds: [q.yes] }, { questionId: q.text, text: " halo " }]);

    const rows = await answerRows(m.id);
    expect(rows.map((r) => [r.questionId, r.optionId, r.textValue])).toEqual([
      [q.choice, q.yes, null],
      [q.text, null, "halo"],
    ]);
    const entry = await db.auditLog.findFirst({
      where: { action: "survey_response.save", groupId: fx.leaf.id },
      orderBy: { id: "desc" },
    });
    expect(entry).toMatchObject({ entity: "SurveyResponse", actorId: fx.actorId });
    expect(entry?.before).toBeNull();
    expect(entry?.meta).toMatchObject({ surveyId, memberId: m.id });
  });

  it("throws ForbiddenError for a user above the survey group and writes nothing", async () => {
    const m = await newMember(fx.leaf.id);
    await expect(save(ownerRoot(), m.id, [{ questionId: q.choice, optionIds: [q.yes] }])).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await db.surveyResponse.count({ where: { surveyId, memberId: m.id } })).toBe(0);
  });

  it("throws NotFoundError for a member outside the caller's scope", async () => {
    const m = await newMember(fx.otherLeaf.id);
    await expect(save(userLeaf(), m.id, [{ questionId: q.choice, optionIds: [q.yes] }])).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(await db.surveyResponse.count({ where: { surveyId, memberId: m.id } })).toBe(0);
  });

  it("rejects an inactive member", async () => {
    const m = await newMember(fx.leaf.id, "KELUAR");
    await expect(save(userLeaf(), m.id, [{ questionId: q.choice, optionIds: [q.yes] }])).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(await db.surveyResponse.count({ where: { surveyId, memberId: m.id } })).toBe(0);
  });

  it("rejects invalid answers (missing required) and writes nothing", async () => {
    const m = await newMember(fx.leaf.id);
    await expect(save(userLeaf(), m.id, [{ questionId: q.text, text: "x" }])).rejects.toBeInstanceOf(ValidationError);
    expect(await db.surveyResponse.count({ where: { surveyId, memberId: m.id } })).toBe(0);
  });

  it("re-save keeps one response, replaces answers and audits the previous ones as before", async () => {
    const m = await newMember(fx.leaf.id);
    await save(userLeaf(), m.id, [{ questionId: q.choice, optionIds: [q.yes] }, { questionId: q.text, text: "lama" }]);
    await save(userLeaf(), m.id, [{ questionId: q.choice, optionIds: [q.no] }]);

    expect(await db.surveyResponse.count({ where: { surveyId, memberId: m.id } })).toBe(1);
    expect((await answerRows(m.id)).map((r) => [r.questionId, r.optionId])).toEqual([[q.choice, q.no]]);

    const entry = await db.auditLog.findFirst({
      where: { action: "survey_response.save", groupId: fx.leaf.id },
      orderBy: { id: "desc" },
    });
    expect(entry?.before).toMatchObject([{ questionId: q.choice, optionId: q.yes }, { questionId: q.text, textValue: "lama" }]);
    expect(entry?.after).toMatchObject([{ questionId: q.choice, optionId: q.no }]);
  });

  it("keeps answers to archived questions when re-saving", async () => {
    const m = await newMember(fx.leaf.id);
    await save(userLeaf(), m.id, [{ questionId: q.choice, optionIds: [q.yes] }, { questionId: q.text, text: "arsip" }]);

    // Archive the text question (answered → archived rather than deleted).
    const stored = await db.surveyQuestion.findMany({
      where: { surveyId },
      orderBy: { order: "asc" },
      include: { options: { orderBy: { order: "asc" } } },
    });
    await updateSurvey(
      adminBranch(),
      surveyId,
      surveyFormSchema.parse({
        title: "Uji Respons",
        questions: stored.map((s) => ({
          id: s.id,
          type: s.type,
          label: s.label,
          required: s.required,
          archived: s.id === q.text || s.archivedAt !== null,
          options: s.options.map((o) => ({ id: o.id, label: o.label })),
        })),
      }),
    );

    await save(userLeaf(), m.id, [{ questionId: q.choice, optionIds: [q.no] }]);
    expect((await answerRows(m.id)).map((r) => [r.questionId, r.optionId, r.textValue])).toEqual([
      [q.text, null, "arsip"],
      [q.choice, q.no, null],
    ]);
  });

  it("rolls back the save when the audit insert fails", async () => {
    const m = await newMember(fx.leaf.id);
    auditControl.fail = true;
    await expect(save(userLeaf(), m.id, [{ questionId: q.choice, optionIds: [q.yes] }])).rejects.toThrow("audit failed");
    expect(await db.surveyResponse.count({ where: { surveyId, memberId: m.id } })).toBe(0);
    expect(await answerRows(m.id)).toEqual([]);
  });

  describe("deleteResponse", () => {
    it("removes the response and audits the deleted answers", async () => {
      const m = await newMember(fx.leaf.id);
      await save(userLeaf(), m.id, [{ questionId: q.choice, optionIds: [q.yes] }]);

      await deleteResponse(userLeaf(), { surveyId, memberId: m.id });

      expect(await db.surveyResponse.count({ where: { surveyId, memberId: m.id } })).toBe(0);
      expect(await answerRows(m.id)).toEqual([]);
      const entry = await db.auditLog.findFirst({
        where: { action: "survey_response.delete", groupId: fx.leaf.id },
        orderBy: { id: "desc" },
      });
      expect(entry).toMatchObject({ entity: "SurveyResponse" });
      expect(entry?.before).toMatchObject([{ questionId: q.choice, optionId: q.yes }]);
      expect(entry?.meta).toMatchObject({ surveyId, memberId: m.id });
    });

    it("still deletes the response of a member who has since left", async () => {
      const m = await newMember(fx.leaf.id);
      await save(userLeaf(), m.id, [{ questionId: q.choice, optionIds: [q.yes] }]);
      await db.member.update({ where: { id: m.id }, data: { status: "KELUAR" } });

      await deleteResponse(userLeaf(), { surveyId, memberId: m.id });
      expect(await db.surveyResponse.count({ where: { surveyId, memberId: m.id } })).toBe(0);
    });

    it("throws ForbiddenError for an ancestor and keeps the response", async () => {
      const m = await newMember(fx.leaf.id);
      await save(userLeaf(), m.id, [{ questionId: q.choice, optionIds: [q.yes] }]);

      await expect(deleteResponse(ownerRoot(), { surveyId, memberId: m.id })).rejects.toBeInstanceOf(ForbiddenError);
      expect(await db.surveyResponse.count({ where: { surveyId, memberId: m.id } })).toBe(1);
    });

    it("throws NotFoundError when the member has no response", async () => {
      const m = await newMember(fx.leaf.id);
      await expect(deleteResponse(userLeaf(), { surveyId, memberId: m.id })).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
