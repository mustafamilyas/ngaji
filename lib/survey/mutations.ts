import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { resolveSurvey } from "@/lib/resolve";
import type { QuestionType } from "@/lib/validation/enums";
import type { SurveyForm, SurveyQuestionInput } from "@/lib/validation/survey";
import { type CurrentForm, planFormUpdate } from "./form-plan";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Survey with every question and option (archived included), in form order — the audit snapshot. */
function loadSnapshot(tx: Tx, surveyId: number) {
  return tx.survey.findUniqueOrThrow({
    where: { id: surveyId },
    include: {
      questions: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        include: { options: { orderBy: [{ order: "asc" }, { id: "asc" }] } },
      },
    },
  });
}

/** Keeps the original archive timestamp when an archived row stays archived. */
function archivedAt(archived: boolean, current: Date | null, now: Date): Date | null {
  return archived ? (current ?? now) : null;
}

function questionData(
  q: Pick<SurveyQuestionInput, "type" | "label" | "helpText" | "required" | "scaleMin" | "scaleMax">,
  order: number,
) {
  return {
    order,
    type: q.type,
    label: q.label,
    helpText: q.helpText ?? null,
    required: q.required,
    scaleMin: q.scaleMin ?? null,
    scaleMax: q.scaleMax ?? null,
  };
}

/** The owning group is always the creator's own group; the client never chooses it. */
export async function createSurvey(session: SessionUser, form: SurveyForm) {
  authorize(session, "survey.create", { groupId: session.groupId });
  const now = new Date();

  return db.$transaction(async (tx) => {
    const created = await tx.survey.create({
      data: {
        groupId: session.groupId,
        createdById: Number(session.id),
        title: form.title,
        description: form.description ?? null,
        questions: {
          create: form.questions.map((q, qi) => ({
            ...questionData(q, qi),
            archivedAt: archivedAt(q.archived ?? false, null, now),
            options: {
              create: q.options.map((o, oi) => ({
                order: oi,
                label: o.label,
                archivedAt: archivedAt(o.archived ?? false, null, now),
              })),
            },
          })),
        },
      },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "survey.create",
      entity: "Survey",
      entityId: created.id,
      groupId: created.groupId,
      after: await loadSnapshot(tx, created.id),
    });
    return created;
  });
}

/**
 * Saves the whole submitted form (DESIGN.md: one `survey.update` per save).
 * The lock is evaluated inside the transaction so a response saved
 * concurrently can't slip between the check and the write.
 */
export async function updateSurvey(session: SessionUser, surveyId: number, form: SurveyForm) {
  const survey = await resolveSurvey(session, surveyId);
  authorize(session, "survey.update", { groupId: survey.groupId });
  const now = new Date();

  return db.$transaction(async (tx) => {
    const before = await loadSnapshot(tx, survey.id);
    const answered = await tx.surveyAnswer.findMany({
      where: { questionId: { in: before.questions.map((q) => q.id) } },
      select: { questionId: true, optionId: true },
      distinct: ["questionId", "optionId"],
    });
    const answeredQuestionIds = new Set(answered.map((a) => a.questionId));
    const answeredOptionIds = new Set(answered.flatMap((a) => (a.optionId === null ? [] : [a.optionId])));

    const current: CurrentForm = {
      questions: before.questions.map((q) => ({
        id: q.id,
        type: q.type as QuestionType,
        scaleMin: q.scaleMin,
        scaleMax: q.scaleMax,
        archived: q.archivedAt !== null,
        options: q.options.map((o) => ({ id: o.id, archived: o.archivedAt !== null })),
      })),
    };
    const plan = planFormUpdate(current, form, answeredQuestionIds, answeredOptionIds);
    if (!plan.ok) throw new ValidationError(plan.violations[0].message);

    const storedQuestions = new Map(before.questions.map((q) => [q.id, q]));
    const storedOptions = new Map(before.questions.flatMap((q) => q.options).map((o) => [o.id, o]));

    for (const op of plan.ops) {
      switch (op.kind) {
        case "create":
          await tx.surveyQuestion.create({
            data: {
              surveyId: survey.id,
              ...questionData(op, op.order),
              archivedAt: archivedAt(op.archived, null, now),
              options: {
                create: op.options.map((o) => ({
                  order: o.order,
                  label: o.label,
                  archivedAt: archivedAt(o.archived, null, now),
                })),
              },
            },
          });
          break;
        case "update": {
          const stored = storedQuestions.get(op.id);
          await tx.surveyQuestion.update({
            where: { id: op.id },
            data: { ...questionData(op, op.order), archivedAt: archivedAt(op.archived, stored?.archivedAt ?? null, now) },
          });
          for (const o of op.options.update) {
            await tx.surveyOption.update({
              where: { id: o.id },
              data: {
                order: o.order,
                label: o.label,
                archivedAt: archivedAt(o.archived, storedOptions.get(o.id)?.archivedAt ?? null, now),
              },
            });
          }
          if (op.options.create.length > 0) {
            await tx.surveyOption.createMany({
              data: op.options.create.map((o) => ({
                questionId: op.id,
                order: o.order,
                label: o.label,
                archivedAt: archivedAt(o.archived, null, now),
              })),
            });
          }
          if (op.options.archive.length > 0) {
            await tx.surveyOption.updateMany({ where: { id: { in: op.options.archive } }, data: { archivedAt: now } });
          }
          if (op.options.delete.length > 0) {
            await tx.surveyOption.deleteMany({ where: { id: { in: op.options.delete } } });
          }
          break;
        }
        case "archive":
          await tx.surveyQuestion.update({ where: { id: op.id }, data: { archivedAt: now } });
          break;
        case "delete":
          // Never answered, so it never held data; its options cascade.
          await tx.surveyQuestion.delete({ where: { id: op.id } });
          break;
      }
    }

    const updated = await tx.survey.update({
      where: { id: survey.id },
      data: { title: form.title, description: form.description ?? null },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "survey.update",
      entity: "Survey",
      entityId: survey.id,
      groupId: survey.groupId,
      before,
      after: await loadSnapshot(tx, survey.id),
    });
    return updated;
  });
}

/** Soft delete: questions, responses and answers are kept but no longer shown or counted. */
export async function deleteSurvey(session: SessionUser, surveyId: number) {
  const survey = await resolveSurvey(session, surveyId);
  authorize(session, "survey.delete", { groupId: survey.groupId });

  return db.$transaction(async (tx) => {
    const before = await loadSnapshot(tx, survey.id);
    const deleted = await tx.survey.update({ where: { id: survey.id }, data: { deletedAt: new Date() } });
    await audit(tx, {
      actorId: Number(session.id),
      action: "survey.delete",
      entity: "Survey",
      entityId: survey.id,
      groupId: survey.groupId,
      before,
      after: { deletedAt: deleted.deletedAt },
    });
    return deleted;
  });
}
