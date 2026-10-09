import type { SessionUser } from "@/lib/auth/session-user";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
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
  const page = filter.page && filter.page > 0 ? Math.floor(filter.page) : 1;

  const groupPaths =
    filter.groupIds && filter.groupIds.length > 0
      ? (await resolveGroups(session, filter.groupIds)).map((g) => g.path)
      : [session.groupPath];

  const where = {
    OR: groupPaths.map((path) => ({ group: { path: { startsWith: path } } })),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.search ? { name: { contains: filter.search } } : {}),
  };

  const [members, total] = await Promise.all([
    db.member.findMany({
      where,
      orderBy: { name: "asc" as const },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { group: true },
    }),
    db.member.count({ where }),
  ]);

  return { members, total, page, pageSize: PAGE_SIZE };
}
