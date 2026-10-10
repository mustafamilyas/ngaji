import type { SessionUser } from "@/lib/auth/session-user";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { clampPage } from "@/lib/pagination";
import { resolveGroups } from "@/lib/resolve";
import type { SortState } from "@/lib/sort";
import type { MemberStatus } from "@/lib/validation/enums";

/** Sortable `/anggota` columns → the field they order by. Keys match `MEMBER_COLUMNS` (plus the name). */
const MEMBER_SORT_FIELDS = {
  nama: (dir) => ({ name: dir }),
  grup: (dir) => ({ group: { name: dir } }),
  jenisKelamin: (dir) => ({ sex: dir }),
  tanggalLahir: (dir) => ({ birthDate: dir }),
  status: (dir) => ({ status: dir }),
  tempatLahir: (dir) => ({ birthPlace: dir }),
  statusNikah: (dir) => ({ maritalStatus: dir }),
  pekerjaan: (dir) => ({ workStatus: dir }),
  tanggalMasuk: (dir) => ({ joinedAt: dir }),
} satisfies Record<string, (dir: "asc" | "desc") => object>;

export type MemberSortKey = keyof typeof MEMBER_SORT_FIELDS;
export const MEMBER_SORT_KEYS = Object.keys(MEMBER_SORT_FIELDS) as MemberSortKey[];
export const DEFAULT_MEMBER_SORT: SortState<MemberSortKey> = { key: "nama", dir: "asc" };

export type ListMembersFilter = {
  page?: number;
  search?: string;
  /** Members in any of these groups or their descendants; default the caller's whole scope. */
  groupIds?: number[];
  status?: MemberStatus;
  sort?: SortState<MemberSortKey>;
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
    // Name then id as tie-breakers keep paging stable when many rows share a value.
    orderBy: [
      MEMBER_SORT_FIELDS[(filter.sort ?? DEFAULT_MEMBER_SORT).key]((filter.sort ?? DEFAULT_MEMBER_SORT).dir),
      { name: "asc" as const },
      { id: "asc" as const },
    ],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { group: { include: { parent: { select: { name: true } } } } },
  });

  return { members, total, page, pageSize: PAGE_SIZE };
}
