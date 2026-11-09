import type { SessionUser } from "@/lib/auth/session-user";
import { AGE_BRACKETS, EMBEDDED_PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { today } from "@/lib/dates";
import { paginate } from "@/lib/pagination";
import { resolveGroup, resolveSurvey } from "@/lib/resolve";
import { isInScope } from "@/lib/scope";
import {
  MARITAL_STATUSES,
  type MaritalStatus,
  type QuestionType,
  SEXES,
  type Sex,
  WORK_STATUSES,
  type WorkStatus,
} from "@/lib/validation/enums";
import { type ChoiceSummaryRow, type ScaleSummary, ageBracketRange, summarizeChoice, summarizeScale } from "./summary";

export type SurveyDemographics = {
  sex?: Sex;
  /** `AGE_BRACKETS` label. */
  ageBracket?: string;
  workStatus?: WorkStatus;
  maritalStatus?: MaritalStatus;
};

export type SurveyStatsFilter = {
  /** Selected group G; defaults per survey-statistics spec. Must be in the caller's scope. */
  groupId?: number;
  demographics?: SurveyDemographics;
  /** Name search within "Belum mengisi". */
  search?: string;
  nonRespondentPage?: number;
  /** The one text list that paginates; every other text question shows page 1. */
  text?: { questionId: number; page: number };
};

function oneOf<T extends string>(allowed: readonly T[], value: string | undefined): T | undefined {
  return allowed.find((a) => a === value);
}

/** Raw URL params (`?jk=&umur=&kerja=&nikah=`) → filter; invalid or empty values are dropped, never an error. */
export function parseSurveyDemographics(raw: {
  jk?: string;
  umur?: string;
  kerja?: string;
  nikah?: string;
}): SurveyDemographics {
  const result: SurveyDemographics = {};
  const sex = oneOf(SEXES, raw.jk);
  if (sex) result.sex = sex;
  const bracket = AGE_BRACKETS.find((b) => b.label === raw.umur);
  if (bracket) result.ageBracket = bracket.label;
  const workStatus = oneOf(WORK_STATUSES, raw.kerja);
  if (workStatus) result.workStatus = workStatus;
  const maritalStatus = oneOf(MARITAL_STATUSES, raw.nikah);
  if (maritalStatus) result.maritalStatus = maritalStatus;
  return result;
}

export type Rate = { expected: number; answered: number; percent: number };

export type TextAnswer = { memberName: string; text: string; updatedAt: Date };

type QuestionBase = {
  id: number;
  label: string;
  helpText: string | null;
  required: boolean;
  archived: boolean;
  /** Responses in the population that have an answer to this question. */
  answeredCount: number;
};

export type QuestionResult =
  | (QuestionBase & { type: "SINGLE_CHOICE" | "MULTI_CHOICE"; options: ChoiceSummaryRow[] })
  | (QuestionBase & { type: "NUMBER"; average: number | null; min: number | null; max: number | null })
  | (QuestionBase & { type: "SCALE" } & ScaleSummary)
  | (QuestionBase & {
      type: "SHORT_TEXT" | "LONG_TEXT";
      answers: TextAnswer[];
      total: number;
      page: number;
      pageSize: number;
    });

export type BreakdownQuestion =
  | { questionId: number; type: "SINGLE_CHOICE" | "MULTI_CHOICE"; options: ChoiceSummaryRow[] }
  | ({ questionId: number; type: "SCALE" } & ScaleSummary);

export type BreakdownRow = { groupId: number; groupName: string; rate: Rate; questions: BreakdownQuestion[] };

export type SurveyStatistics = {
  group: { id: number; name: string; path: string };
  rate: Rate;
  nonRespondents: {
    rows: { memberId: number; name: string; groupName: string }[];
    total: number;
    page: number;
    pageSize: number;
  };
  /** Caller is in the owning group or below, so each non-respondent can link to the entry page. */
  canRecord: boolean;
  questions: QuestionResult[];
  /** One row per direct child of G that intersects the owner's subtree; null when G has no children. */
  breakdown: BreakdownRow[] | null;
};

/** Longest path that is within both subtrees, or null when they are disjoint (paths end with `/`, so prefixes are safe). */
function intersectPaths(a: string, b: string): string | null {
  if (a.startsWith(b)) return a;
  if (b.startsWith(a)) return b;
  return null;
}

function rateOf(expected: number, answered: number): Rate {
  return { expected, answered, percent: expected > 0 ? Math.round((answered / expected) * 1000) / 10 : 0 };
}

function memberWhere(path: string | null, demographics: SurveyDemographics, asOf: string) {
  const bracket = demographics.ageBracket ? AGE_BRACKETS.find((b) => b.label === demographics.ageBracket) : undefined;
  const range = bracket ? ageBracketRange(bracket, asOf) : undefined;
  return {
    deletedAt: null,
    // A disjoint subtree has no members: `in: []` matches nothing.
    ...(path === null ? { id: { in: [] as number[] } } : { group: { deletedAt: null, path: { startsWith: path } } }),
    ...(demographics.sex ? { sex: demographics.sex } : {}),
    ...(demographics.workStatus ? { workStatus: demographics.workStatus } : {}),
    ...(demographics.maritalStatus ? { maritalStatus: demographics.maritalStatus } : {}),
    ...(range ? { birthDate: { ...(range.from ? { gte: range.from } : {}), lte: range.to } } : {}),
  };
}

/**
 * Results of one survey for one selected group (survey-statistics spec).
 *
 * Population = non-deleted members in subtree(G) ∩ subtree(X) (X = owner),
 * narrowed by the demographic filters. G must be in the caller's scope, so
 * the population never reaches beyond it; out-of-scope G → NotFound. An
 * in-scope G unrelated to X yields an empty population, not an error.
 *
 * Aggregation happens in memory over one members query and one answers query
 * (a single organisation is small, and the sub-group breakdown needs the same
 * rows bucketed by group anyway); text lists are paginated in the database.
 */
export async function surveyStatistics(
  session: SessionUser,
  surveyId: number,
  filter: SurveyStatsFilter = {},
): Promise<SurveyStatistics> {
  const survey = await resolveSurvey(session, surveyId);
  const ownerPath = survey.group.path;
  const canRecord = isInScope(session.groupPath, ownerPath);

  const group = filter.groupId
    ? await resolveGroup(session, filter.groupId)
    : isInScope(ownerPath, session.groupPath)
      ? survey.group
      : await resolveGroup(session, session.groupId);

  const demographics = filter.demographics ?? {};
  const asOf = today(session.timeZone);
  const popPath = intersectPaths(group.path, ownerPath);
  const populationWhere = memberWhere(popPath, demographics, asOf);

  const questions = await db.surveyQuestion.findMany({
    where: { surveyId: survey.id },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    include: { options: { orderBy: [{ order: "asc" }, { id: "asc" }] } },
  });
  const isText = (type: string) => type === "SHORT_TEXT" || type === "LONG_TEXT";
  const aggregated = questions.filter((qn) => !isText(qn.type));

  const members = await db.member.findMany({
    where: populationWhere,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      status: true,
      group: { select: { name: true, path: true } },
      surveyResponses: { where: { surveyId: survey.id }, select: { id: true } },
    },
  });
  const active = members.filter((m) => m.status === "AKTIF");
  const answeredActive = active.filter((m) => m.surveyResponses.length > 0);
  const rate = rateOf(active.length, answeredActive.length);

  const needle = filter.search?.trim().toLowerCase();
  const waiting = active
    .filter((m) => m.surveyResponses.length === 0)
    .filter((m) => !needle || m.name.toLowerCase().includes(needle));
  const paged = paginate(waiting, filter.nonRespondentPage ?? 1, EMBEDDED_PAGE_SIZE);

  const answerRows = await db.surveyAnswer.findMany({
    where: {
      questionId: { in: aggregated.map((qn) => qn.id) },
      response: { surveyId: survey.id, member: populationWhere },
    },
    select: {
      responseId: true,
      questionId: true,
      optionId: true,
      numberValue: true,
      response: { select: { member: { select: { group: { select: { path: true } } } } } },
    },
  });
  type Row = (typeof answerRows)[number];
  const rowsByQuestion = new Map<number, Row[]>();
  for (const row of answerRows) {
    const list = rowsByQuestion.get(row.questionId) ?? [];
    list.push(row);
    rowsByQuestion.set(row.questionId, list);
  }

  const summarizeRows = (qn: (typeof questions)[number], rows: Row[]) => {
    const answeredCount = new Set(rows.map((r) => r.responseId)).size;
    if (qn.type === "SINGLE_CHOICE" || qn.type === "MULTI_CHOICE") {
      const counts = new Map<number, number>();
      for (const r of rows) if (r.optionId !== null) counts.set(r.optionId, (counts.get(r.optionId) ?? 0) + 1);
      const options = summarizeChoice(
        qn.options.map((o) => ({ id: o.id, label: o.label, archived: o.archivedAt !== null })),
        counts,
        answeredCount,
      );
      return { kind: "choice" as const, answeredCount, options };
    }
    if (qn.type === "SCALE") {
      const counts = new Map<number, number>();
      for (const r of rows) if (r.numberValue !== null) counts.set(r.numberValue, (counts.get(r.numberValue) ?? 0) + 1);
      return { kind: "scale" as const, answeredCount, scale: summarizeScale(qn.scaleMin ?? 1, qn.scaleMax ?? 5, counts) };
    }
    const values = rows.flatMap((r) => (r.numberValue === null ? [] : [r.numberValue]));
    return {
      kind: "number" as const,
      answeredCount,
      number: {
        average: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null,
        min: values.length > 0 ? Math.min(...values) : null,
        max: values.length > 0 ? Math.max(...values) : null,
      },
    };
  };

  const results: QuestionResult[] = [];
  for (const qn of questions) {
    const base = {
      id: qn.id,
      label: qn.label,
      helpText: qn.helpText,
      required: qn.required,
      archived: qn.archivedAt !== null,
    };
    const type = qn.type as QuestionType;
    if (type === "SHORT_TEXT" || type === "LONG_TEXT") {
      const where = {
        questionId: qn.id,
        textValue: { not: null },
        response: { surveyId: survey.id, member: populationWhere },
      };
      const total = await db.surveyAnswer.count({ where });
      const requested = filter.text?.questionId === qn.id ? filter.text.page : 1;
      const page = Math.min(Math.max(1, Math.floor(requested)), Math.max(1, Math.ceil(total / EMBEDDED_PAGE_SIZE)));
      const rows = await db.surveyAnswer.findMany({
        where,
        orderBy: [{ response: { updatedAt: "desc" } }, { id: "desc" }],
        skip: (page - 1) * EMBEDDED_PAGE_SIZE,
        take: EMBEDDED_PAGE_SIZE,
        select: { textValue: true, response: { select: { updatedAt: true, member: { select: { name: true } } } } },
      });
      results.push({
        ...base,
        type,
        answeredCount: total,
        total,
        page,
        pageSize: EMBEDDED_PAGE_SIZE,
        answers: rows.map((r) => ({
          memberName: r.response.member.name,
          text: r.textValue ?? "",
          updatedAt: r.response.updatedAt,
        })),
      });
      continue;
    }
    const summary = summarizeRows(qn, rowsByQuestion.get(qn.id) ?? []);
    if (summary.kind === "choice" && (type === "SINGLE_CHOICE" || type === "MULTI_CHOICE")) {
      results.push({ ...base, type, answeredCount: summary.answeredCount, options: summary.options });
    } else if (summary.kind === "scale" && type === "SCALE") {
      results.push({ ...base, type, answeredCount: summary.answeredCount, ...summary.scale });
    } else if (summary.kind === "number" && type === "NUMBER") {
      results.push({ ...base, type, answeredCount: summary.answeredCount, ...summary.number });
    }
  }

  // Breakdown: direct children of G that share members with the owner's subtree.
  const children = await db.group.findMany({ where: { parentId: group.id }, orderBy: [{ name: "asc" }, { id: "asc" }] });
  let breakdown: BreakdownRow[] | null = null;
  if (children.length > 0) {
    const bucket = children.filter((child) => intersectPaths(child.path, ownerPath) !== null);
    breakdown = bucket.map((child) => {
      const inChild = (path: string) => path.startsWith(child.path);
      const childActive = active.filter((m) => inChild(m.group.path));
      const childRate = rateOf(childActive.length, childActive.filter((m) => m.surveyResponses.length > 0).length);
      const childQuestions: BreakdownQuestion[] = [];
      for (const qn of aggregated) {
        if (qn.type === "NUMBER") continue;
        const rows = (rowsByQuestion.get(qn.id) ?? []).filter((r) => inChild(r.response.member.group.path));
        const summary = summarizeRows(qn, rows);
        if (summary.kind === "choice") {
          childQuestions.push({ questionId: qn.id, type: qn.type as "SINGLE_CHOICE" | "MULTI_CHOICE", options: summary.options });
        } else if (summary.kind === "scale") {
          childQuestions.push({ questionId: qn.id, type: "SCALE", ...summary.scale });
        }
      }
      return { groupId: child.id, groupName: child.name, rate: childRate, questions: childQuestions };
    });
  }

  return {
    group: { id: group.id, name: group.name, path: group.path },
    rate,
    nonRespondents: {
      rows: paged.items.map((m) => ({ memberId: m.id, name: m.name, groupName: m.group.name })),
      total: paged.total,
      page: paged.page,
      pageSize: paged.pageSize,
    },
    canRecord,
    questions: results,
    breakdown,
  };
}
