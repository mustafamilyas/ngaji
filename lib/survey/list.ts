import type { SessionUser } from "@/lib/auth/session-user";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { clampPage } from "@/lib/pagination";
import { resolveGroups } from "@/lib/resolve";

export type ListSurveysFilter = {
  page?: number;
  search?: string;
  /** Surveys that apply to any of these groups; default the caller's own group. */
  groupIds?: number[];
};

/** `"1/5/9/"` → `["1/", "1/5/", "1/5/9/"]`: the group itself and every ancestor. */
function selfAndAncestorPaths(path: string): string[] {
  const ids = path.split("/").filter(Boolean);
  return ids.map((_, i) => `${ids.slice(0, i + 1).join("/")}/`);
}

/**
 * Visible surveys (survey-forms spec "Survey list"), newest first. A survey
 * applies to group Y when it is owned by an ancestor of Y, Y itself or a
 * descendant of Y (DESIGN.md §5.3, as for activities); with no group
 * selected Y is the caller's own group, which is exactly the visible set.
 * Selected groups are resolved and scope-checked (outside scope → 404).
 *
 * `responseCount` only counts responses of non-deleted members in the
 * caller's scope, so a user below the owner never learns other branches'
 * participation. `inherited` = owned above the caller's own group.
 */
export async function listSurveys(session: SessionUser, filter: ListSurveysFilter = {}) {
  const groupPaths =
    filter.groupIds && filter.groupIds.length > 0
      ? (await resolveGroups(session, filter.groupIds)).map((g) => g.path)
      : [session.groupPath];

  const where = {
    OR: groupPaths.flatMap((path) => [
      { group: { path: { in: selfAndAncestorPaths(path) } } },
      { group: { path: { startsWith: path } } },
    ]),
    ...(filter.search ? { title: { contains: filter.search } } : {}),
  };

  const total = await db.survey.count({ where });
  const page = clampPage(filter.page ?? 1, total, PAGE_SIZE);
  const rows = await db.survey.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      title: true,
      createdAt: true,
      group: { select: { id: true, name: true, path: true } },
      _count: {
        select: {
          responses: {
            where: { member: { deletedAt: null, group: { path: { startsWith: session.groupPath } } } },
          },
        },
      },
    },
  });

  const surveys = rows.map(({ group: { path, ...group }, _count, ...survey }) => ({
    ...survey,
    group,
    responseCount: _count.responses,
    inherited: path !== session.groupPath && session.groupPath.startsWith(path),
  }));

  return { surveys, total, page, pageSize: PAGE_SIZE };
}
