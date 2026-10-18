import type { SessionUser } from "@/lib/auth/session-user";
import { canEditSurvey } from "@/lib/authz";
import { db } from "@/lib/db";
import { resolveSurvey } from "@/lib/resolve";
import type { QuestionType } from "@/lib/validation/enums";
import type { SurveyFormInput } from "@/lib/validation/survey";
import { findAnsweredIds } from "./locks";

/**
 * Everything the `/dashboard/survei/[id]` page needs. Resolving enforces visibility
 * (404 outside reach); `canEdit` is the owning group's ADMIN+ rule.
 *
 * `form` is the stored form in builder shape — ids and `archived` flags
 * included, archived questions/options kept in place — so the edit tab can
 * resubmit it as-is. `responseCount` only counts non-deleted members in the
 * caller's scope, like the list.
 */
export async function loadSurveyDetail(session: SessionUser, surveyId: number) {
  const survey = await resolveSurvey(session, surveyId);

  const [questions, responseCount] = await Promise.all([
    db.surveyQuestion.findMany({
      where: { surveyId: survey.id },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      include: { options: { orderBy: [{ order: "asc" }, { id: "asc" }] } },
    }),
    db.surveyResponse.count({
      where: { surveyId: survey.id, member: { deletedAt: null, group: { path: { startsWith: session.groupPath } } } },
    }),
  ]);
  const answered = await findAnsweredIds(
    db,
    questions.map((q) => q.id),
  );

  const form: SurveyFormInput = {
    title: survey.title,
    description: survey.description ?? undefined,
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type as QuestionType,
      label: q.label,
      helpText: q.helpText ?? undefined,
      required: q.required,
      scaleMin: q.scaleMin ?? undefined,
      scaleMax: q.scaleMax ?? undefined,
      archived: q.archivedAt !== null,
      options: q.options.map((o) => ({ id: o.id, label: o.label, archived: o.archivedAt !== null })),
    })),
  };

  return {
    survey: { id: survey.id, title: survey.title, description: survey.description, group: survey.group },
    form,
    canEdit: canEditSurvey(session, survey.groupId),
    inherited: survey.group.path !== session.groupPath && session.groupPath.startsWith(survey.group.path),
    responseCount,
    lockedQuestionIds: [...answered.questionIds],
    lockedOptionIds: [...answered.optionIds],
  };
}
