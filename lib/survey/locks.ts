import type { db } from "@/lib/db";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * The "form locks once answered" state, derived from `SurveyAnswer` rows
 * (never stored): ids of questions and options that have at least one answer.
 */
export async function findAnsweredIds(client: Pick<Tx, "surveyAnswer">, questionIds: number[]) {
  const answered = await client.surveyAnswer.findMany({
    where: { questionId: { in: questionIds } },
    select: { questionId: true, optionId: true },
    distinct: ["questionId", "optionId"],
  });
  return {
    questionIds: new Set(answered.map((a) => a.questionId)),
    optionIds: new Set(answered.flatMap((a) => (a.optionId === null ? [] : [a.optionId]))),
  };
}
