import type { SessionUser } from "@/lib/auth/session-user";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { resolveGroup } from "@/lib/resolve";
import type { MemberStatus } from "@/lib/validation/enums";

export type ListMembersFilter = {
  page?: number;
  search?: string;
  groupId?: number;
  status?: MemberStatus;
};

/** Scope-filtered, searchable, paginated member list (member-management spec "List, search, filter, pagination"). */
export async function listMembers(session: SessionUser, filter: ListMembersFilter = {}) {
  const page = filter.page && filter.page > 0 ? Math.floor(filter.page) : 1;

  let groupPathFilter = session.groupPath;
  if (filter.groupId !== undefined) {
    const group = await resolveGroup(session, filter.groupId);
    groupPathFilter = group.path;
  }

  const where = {
    group: { path: { startsWith: groupPathFilter } },
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
