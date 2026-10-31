import type { Prisma } from "@/lib/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/session-user";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { today as todayIn } from "@/lib/dates";
import type { MemberColumnKey } from "@/lib/member/columns";
import { clampPage } from "@/lib/pagination";
import { visibleTagLinks } from "@/lib/tag/include";
import { resolveDefinitionGroupsLenient, resolveDefinitionTagsLenient } from "@/lib/resolve";
import type { Definition } from "@/lib/validation/member-view";
import { buildOrderBy, buildWhere, type QueryContext } from "./query";

/**
 * Column key → the member fields it needs. `name` and `id` are always selected.
 * Only chosen columns are fetched, so a hidden phone/address/email never leaves
 * the database layer (member-views spec "Columns").
 */
const COLUMN_SELECT = {
  grup: { group: { select: { id: true, name: true, parent: { select: { name: true } } } } },
  jenisKelamin: { sex: true },
  tanggalLahir: { birthDate: true },
  status: { status: true },
  whatsapp: { phone: true },
  hp: { phone: true },
  tempatLahir: { birthPlace: true },
  alamat: { address: true },
  statusNikah: { maritalStatus: true },
  pekerjaan: { workStatus: true },
  email: { email: true },
  tanggalMasuk: { joinedAt: true },
} satisfies Record<Exclude<MemberColumnKey, "tag">, Prisma.MemberSelect>;

/** The tag column depends on who is looking (only visible tags), so it is the one select built from the session. */
export function memberSelectFor(columns: readonly MemberColumnKey[], session: Pick<SessionUser, "groupPath">) {
  return Object.assign(
    { id: true, name: true },
    ...columns.map((key) => (key === "tag" ? { tags: visibleTagLinks(session) } : COLUMN_SELECT[key])),
  ) as Prisma.MemberSelect;
}

export type PreparedView = {
  /** The definition with unusable group rules removed. */
  definition: Definition;
  /** Scope + not-deleted + the definition's rules, ready for any `member` query or count. */
  where: Prisma.MemberWhereInput;
  today: string;
  /** Some rules were dropped (group deleted or out of scope); drives the "diabaikan" notice. */
  dropped: boolean;
  /** Fields of the chosen columns only, for every `member` query of this view. */
  select: Prisma.MemberSelect;
};

/**
 * Resolves the definition's groups against the viewer's scope (lenient: bad
 * group rules are dropped) and builds the one `where` every result query uses.
 * The scope and `deletedAt: null` terms are ANDed in here, so no definition can
 * widen the result.
 */
export async function prepareView(
  session: SessionUser,
  definition: Definition,
  today: string = todayIn(session.timeZone),
): Promise<PreparedView> {
  const groupsResolved = await resolveDefinitionGroupsLenient(session, definition);
  const tagsResolved = await resolveDefinitionTagsLenient(session, groupsResolved.definition);
  const resolved = tagsResolved.definition;
  const dropped = groupsResolved.dropped || tagsResolved.dropped;

  const groupIds = new Set<number>();
  // Every tag id left after the lenient pass is one the viewer may see.
  const visibleTagIds = new Set<number>();
  for (const group of resolved.filter.groups) {
    for (const rule of group.rules) {
      if (rule.field === "group") for (const id of rule.value as number[]) groupIds.add(id);
      if (rule.field === "tag") for (const id of rule.value as number[]) visibleTagIds.add(id);
    }
  }
  const groups = groupIds.size > 0 ? await db.group.findMany({ where: { id: { in: [...groupIds] } }, select: { id: true, path: true } }) : [];
  const ctx: QueryContext = { today, groupPaths: new Map(groups.map((g) => [g.id, g.path])), visibleTagIds };

  const where: Prisma.MemberWhereInput = {
    AND: [{ deletedAt: null, group: { path: { startsWith: session.groupPath } } }, buildWhere(resolved, ctx)],
  };
  return { definition: resolved, where, today, dropped, select: memberSelectFor(resolved.columns, session) };
}

/** Scope-filtered, paginated, ungrouped result list for a view definition. */
export async function listViewMembers(
  session: SessionUser,
  definition: Definition,
  options: { page?: number; today?: string } = {},
) {
  const prepared = await prepareView(session, definition, options.today);

  const total = await db.member.count({ where: prepared.where });
  const page = clampPage(options.page ?? 1, total, PAGE_SIZE);
  const members = await db.member.findMany({
    where: prepared.where,
    orderBy: buildOrderBy(prepared.definition.sort),
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: prepared.select,
  });

  return { members, total, page, pageSize: PAGE_SIZE, dropped: prepared.dropped };
}
