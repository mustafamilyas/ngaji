import type { SessionUser } from "@/lib/auth/session-user";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { clampPage } from "@/lib/pagination";
import { resolveGroups } from "@/lib/resolve";
import type { MemberStatus } from "@/lib/validation/enums";

export type ListMembersFilter = {
  page?: number;
  search?: string;
  /** Members in any of these groups or their descendants; default the caller's whole scope. */
  groupIds?: number[];
  status?: MemberStatus;
};

/** Scope-filtered, searchable, paginated member list (member-management spec "List, search, filter, pagination"). */
export async function listMembers(session: SessionUser, filter: ListMembersFilter = {}) {
  const groupPaths =
    filter.groupIds && filter.groupIds.length > 0
      ? (await resolveGroups(session, filter.groupIds)).map((g) => g.path)
      : [session.groupPath];

  const where = {
    OR: groupPaths.map((path) => ({ group: { path: { startsWith: path } } })),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.search ? { name: { contains: filter.search } } : {}),
  };

  const total = await db.member.count({ where });
  const page = clampPage(filter.page ?? 1, total, PAGE_SIZE);
  const members = await db.member.findMany({
    where,
    orderBy: { name: "asc" as const },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { group: { include: { parent: { select: { name: true } } } } },
  });

  return { members, total, page, pageSize: PAGE_SIZE };
}
