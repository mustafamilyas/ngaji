import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { getMaxDepth } from "@/lib/group/levels";
import { resolveSurvey } from "@/lib/resolve";
import { isInScope } from "@/lib/scope";
import type { QuestionType } from "@/lib/validation/enums";
import type { SubmittedAnswer } from "./answers";

export type EntryQuestion = {
  id: number;
  type: QuestionType;
  label: string;
  helpText: string | null;
  required: boolean;
  scaleMin: number | null;
  scaleMax: number | null;
  /** Archived questions only appear (read-only) when the selected member already answered them. */
  archived: boolean;
  options: { id: number; label: string; archived: boolean }[];
};

export type EntryMember = { id: number; name: string; groupName: string; hasResponse: boolean };

/**
 * Everything `/survei/[id]/isi` needs. Resolving enforces visibility (404);
 * `canRecord` is "caller is in the owning group or below" — users above only
 * view, so they get no members and the page redirects them to the survey.
 *
 * The member list is every `AKTIF` member of a leaf group in the caller's
 * scope. `memberId` (from `?anggota=`) is only honoured when it is in that
 * list, so a forged id selects nothing and loads no answers.
 */
export async function loadSurveyEntry(session: SessionUser, surveyId: number, memberId?: number) {
  const survey = await resolveSurvey(session, surveyId);
  const canRecord = isInScope(session.groupPath, survey.group.path);
  const base = { survey: { id: survey.id, title: survey.title, groupName: survey.group.name }, canRecord };
  if (!canRecord) {
    return { ...base, members: [] as EntryMember[], questions: [] as EntryQuestion[], answers: [] as SubmittedAnswer[], selectedMemberId: undefined };
  }

  const maxDepth = await getMaxDepth(survey.group.organizationId);
  const rows = await db.member.findMany({
    where: {
      deletedAt: null,
      status: "AKTIF",
      group: { deletedAt: null, depth: maxDepth, path: { startsWith: session.groupPath } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      group: { select: { name: true } },
      surveyResponses: { where: { surveyId: survey.id }, select: { id: true } },
    },
  });
  const members: EntryMember[] = rows.map((m) => ({
    id: m.id,
    name: m.name,
    groupName: m.group.name,
    hasResponse: m.surveyResponses.length > 0,
  }));
  const selectedMemberId = members.some((m) => m.id === memberId) ? memberId : undefined;

  const stored =
    selectedMemberId === undefined
      ? []
      : await db.surveyAnswer.findMany({
          where: { response: { surveyId: survey.id, memberId: selectedMemberId } },
          orderBy: { id: "asc" },
        });

  const answers = groupAnswers(stored);
  const answeredQuestions = new Set(stored.map((a) => a.questionId));
  const pickedOptions = new Set(stored.flatMap((a) => (a.optionId === null ? [] : [a.optionId])));

  const questions = await db.surveyQuestion.findMany({
    where: { surveyId: survey.id },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    include: { options: { orderBy: [{ order: "asc" }, { id: "asc" }] } },
  });

  return {
    ...base,
    members,
    selectedMemberId,
    answers,
    questions: questions
      .filter((q) => q.archivedAt === null || answeredQuestions.has(q.id))
      .map<EntryQuestion>((q) => ({
        id: q.id,
        type: q.type as QuestionType,
        label: q.label,
        helpText: q.helpText,
        required: q.required,
        scaleMin: q.scaleMin,
        scaleMax: q.scaleMax,
        archived: q.archivedAt !== null,
        options: q.options
          .filter((o) => o.archivedAt === null || pickedOptions.has(o.id))
          .map((o) => ({ id: o.id, label: o.label, archived: o.archivedAt !== null })),
      })),
  };
}

/** Stored rows (one per picked option for multi-choice) back to one submitted-shaped entry per question. */
function groupAnswers(
  rows: { questionId: number; optionId: number | null; numberValue: number | null; textValue: string | null }[],
): SubmittedAnswer[] {
  const byQuestion = new Map<number, SubmittedAnswer>();
  for (const row of rows) {
    const answer = byQuestion.get(row.questionId) ?? { questionId: row.questionId };
    if (row.optionId !== null) answer.optionIds = [...(answer.optionIds ?? []), row.optionId];
    if (row.numberValue !== null) answer.number = row.numberValue;
    if (row.textValue !== null) answer.text = row.textValue;
    byQuestion.set(row.questionId, answer);
  }
  return [...byQuestion.values()];
}
