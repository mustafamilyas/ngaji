import type { SessionUser } from "@/lib/auth/session-user";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { clampPage } from "@/lib/pagination";
import { resolveGroups, resolveSurvey } from "@/lib/resolve";
import { isInScope } from "@/lib/scope";

export type ListRespondentsFilter = {
  page?: number;
  search?: string;
  /** Only respondents in these groups or below; outside the caller's scope → NotFound. */
  groupIds?: number[];
};

/**
 * Responses of one survey for the "Responden" tab (survey-responses spec
 * "Respondent list"), newest saved first. Only members in the caller's scope
 * are listed, so a user below the owner never sees other branches' responses.
 * `canRecord` = caller is in the owning group or below; users above only view.
 */
export async function listRespondents(session: SessionUser, surveyId: number, filter: ListRespondentsFilter = {}) {
  const survey = await resolveSurvey(session, surveyId);
  const groupPaths =
    filter.groupIds && filter.groupIds.length > 0
      ? (await resolveGroups(session, filter.groupIds)).map((g) => g.path)
      : undefined;

  const where = {
    surveyId: survey.id,
    member: {
      deletedAt: null,
      group: { deletedAt: null, path: { startsWith: session.groupPath } },
      ...(filter.search ? { name: { contains: filter.search } } : {}),
      ...(groupPaths ? { OR: groupPaths.map((path) => ({ group: { path: { startsWith: path } } })) } : {}),
    },
  };

  const total = await db.surveyResponse.count({ where });
  const page = clampPage(filter.page ?? 1, total, PAGE_SIZE);
  const rows = await db.surveyResponse.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      updatedAt: true,
      member: { select: { id: true, name: true, status: true, group: { select: { name: true } } } },
      recordedBy: { select: { name: true } },
    },
  });

  return {
    respondents: rows.map((r) => ({
      memberId: r.member.id,
      name: r.member.name,
      groupName: r.member.group.name,
      memberStatus: r.member.status,
      recordedByName: r.recordedBy.name,
      updatedAt: r.updatedAt,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    canRecord: isInScope(session.groupPath, survey.group.path),
  };
}
