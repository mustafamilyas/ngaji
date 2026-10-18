import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getMaxDepth } from "@/lib/group/levels";
import { resolveMember, resolveSurvey } from "@/lib/resolve";
import type { QuestionType } from "@/lib/validation/enums";
import type { SurveyResponseDeleteInput, SurveyResponseSaveInput } from "@/lib/validation/survey";
import { type AnswerQuestion, type AnswerRow, validateAnswers } from "./answers";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Resolves ids and authorizes; shared by save and delete (member status is a data rule, checked by save only). */
async function loadContext(session: SessionUser, input: { surveyId: number; memberId: number }) {
  const survey = await resolveSurvey(session, input.surveyId);
  const member = await resolveMember(session, input.memberId);
  const maxDepth = await getMaxDepth(member.group.organizationId);

  return { survey, member, isLeaf: member.group.depth === maxDepth };
}

/** A response's answers as stored (plain rows), the audit before/after shape. */
async function loadAnswers(tx: Pick<Tx, "surveyAnswer">, responseId: number) {
  const rows = await tx.surveyAnswer.findMany({ where: { responseId }, orderBy: { id: "asc" } });
  return rows.map((r) => ({
    questionId: r.questionId,
    optionId: r.optionId,
    numberValue: r.numberValue,
    textValue: r.textValue,
  }));
}

/**
 * Saves (replaces) one member's answers. Replace-all applies to non-archived
 * questions only; stored answers to archived questions stay untouched.
 * A concurrent first save of the same (survey, member) loses on the unique
 * index and fails cleanly (no retry).
 */
export async function saveResponse(session: SessionUser, input: SurveyResponseSaveInput) {
  const { survey, member, isLeaf } = await loadContext(session, input);
  authorize(session, "survey_response.record", {
    surveyGroupPath: survey.group.path,
    memberGroupPath: member.group.path,
    memberIsLeaf: isLeaf,
  });
  if (member.status !== "AKTIF") throw new ValidationError("Anggota tidak aktif");

  const questions = await db.surveyQuestion.findMany({
    where: { surveyId: survey.id },
    include: { options: true },
  });
  const formQuestions: AnswerQuestion[] = questions.map((q) => ({
    id: q.id,
    type: q.type as QuestionType,
    required: q.required,
    scaleMin: q.scaleMin,
    scaleMax: q.scaleMax,
    archived: q.archivedAt !== null,
    options: q.options.map((o) => ({ id: o.id, archived: o.archivedAt !== null })),
  }));

  return db.$transaction(async (tx) => {
    const existingResponse = await tx.surveyResponse.findUnique({
      where: { surveyId_memberId: { surveyId: survey.id, memberId: member.id } },
    });
    const before = existingResponse ? await loadAnswers(tx, existingResponse.id) : null;
    const existingRows: AnswerRow[] = (before ?? []).map((r) => ({
      questionId: r.questionId,
      optionId: r.optionId ?? undefined,
      numberValue: r.numberValue ?? undefined,
      textValue: r.textValue ?? undefined,
    }));

    const validation = validateAnswers(formQuestions, input.answers, existingRows);
    if (!validation.ok) throw new ValidationError(validation.errors[0].message);

    const response = await tx.surveyResponse.upsert({
      where: { surveyId_memberId: { surveyId: survey.id, memberId: member.id } },
      create: { surveyId: survey.id, memberId: member.id, recordedById: Number(session.id) },
      update: { recordedById: Number(session.id) },
    });
    const activeQuestionIds = formQuestions.filter((q) => !q.archived).map((q) => q.id);
    await tx.surveyAnswer.deleteMany({ where: { responseId: response.id, questionId: { in: activeQuestionIds } } });
    if (validation.rows.length > 0) {
      await tx.surveyAnswer.createMany({
        data: validation.rows.map((r) => ({
          responseId: response.id,
          questionId: r.questionId,
          optionId: r.optionId ?? null,
          numberValue: r.numberValue ?? null,
          textValue: r.textValue ?? null,
        })),
      });
    }

    await audit(tx, {
      actorId: Number(session.id),
      action: "survey_response.save",
      entity: "SurveyResponse",
      entityId: response.id,
      groupId: member.groupId,
      before,
      after: await loadAnswers(tx, response.id),
      meta: { surveyId: survey.id, memberId: member.id },
    });
    return response;
  });
}

/** Hard-deletes the response (like attendance rows); the deleted answers live on in the audit entry. */
export async function deleteResponse(session: SessionUser, input: SurveyResponseDeleteInput) {
  const { survey, member, isLeaf } = await loadContext(session, input);
  authorize(session, "survey_response.delete", {
    surveyGroupPath: survey.group.path,
    memberGroupPath: member.group.path,
    memberIsLeaf: isLeaf,
  });

  return db.$transaction(async (tx) => {
    const response = await tx.surveyResponse.findUnique({
      where: { surveyId_memberId: { surveyId: survey.id, memberId: member.id } },
    });
    if (!response) throw new NotFoundError();

    const before = await loadAnswers(tx, response.id);
    await tx.surveyAnswer.deleteMany({ where: { responseId: response.id } });
    await tx.surveyResponse.delete({ where: { id: response.id } });
    await audit(tx, {
      actorId: Number(session.id),
      action: "survey_response.delete",
      entity: "SurveyResponse",
      entityId: response.id,
      groupId: member.groupId,
      before,
      meta: { surveyId: survey.id, memberId: member.id },
    });
  });
}
