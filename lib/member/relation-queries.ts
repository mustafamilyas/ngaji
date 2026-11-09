import type { SessionUser } from "@/lib/auth/session-user";
import { RELATION_PICKER_LIMIT } from "@/lib/constants";
import { db } from "@/lib/db";
import { normalizeMemberCode } from "@/lib/member/code";
import { compareRelatives, relationLabel, type RelationSide } from "@/lib/member/relations";
import { resolveMember } from "@/lib/resolve";
import { isInScope } from "@/lib/scope";
import type { RelationType, Sex } from "@/lib/validation/enums";

/**
 * One Keluarga entry. Only an in-scope relative carries ids (to link to its page and to unlink;
 * the viewed member is in scope, so "both in scope" = "relative in scope"). An out-of-scope
 * relative is name, group name and label only (member-relations spec "Keluarga section").
 */
export type Relative =
  | { inScope: true; memberId: number; relationId: number; label: string; name: string; groupName: string }
  | { inScope: false; label: string; name: string; groupName: string };

const relativeSelect = { id: true, name: true, sex: true, group: { select: { name: true, path: true } } } as const;

/** Relatives of a member the session may view, hiding soft-deleted relatives, in Keluarga order. */
export async function getMemberRelatives(session: SessionUser, memberId: number): Promise<Relative[]> {
  const member = await resolveMember(session, memberId);

  const rows = await db.memberRelation.findMany({
    where: {
      OR: [
        { fromMemberId: member.id, toMember: { deletedAt: null } },
        { toMemberId: member.id, fromMember: { deletedAt: null } },
      ],
    },
    select: { id: true, type: true, fromMemberId: true, fromMember: { select: relativeSelect }, toMember: { select: relativeSelect } },
  });

  return rows
    .map((row) => {
      const side: RelationSide = row.fromMemberId === member.id ? "from" : "to";
      const relative = side === "from" ? row.toMember : row.fromMember;
      return { row, side, type: row.type as RelationType, relative, name: relative.name };
    })
    .sort(compareRelatives)
    .map(({ row, side, type, relative }): Relative => {
      const base = { label: relationLabel(type, side, relative.sex as Sex), name: relative.name, groupName: relative.group.name };
      return isInScope(relative.group.path, session.groupPath)
        ? { inScope: true, memberId: relative.id, relationId: row.id, ...base }
        : { inScope: false, ...base };
    });
}

/**
 * Add-dialog picker: non-deleted members in the session's scope, other than `memberId`, whose name
 * contains `query` or whose code equals it once normalized. Only name, group name and code leave.
 */
export async function searchRelativeCandidates(session: SessionUser, memberId: number, query: string) {
  const member = await resolveMember(session, memberId);
  const search = query.trim();
  if (!search) return [];

  const code = normalizeMemberCode(search);
  const rows = await db.member.findMany({
    where: {
      id: { not: member.id },
      group: { path: { startsWith: session.groupPath } },
      OR: [{ name: { contains: search } }, ...(code ? [{ code }] : [])],
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: RELATION_PICKER_LIMIT,
    select: { id: true, name: true, code: true, group: { select: { name: true } } },
  });
  return rows.map((row) => ({ id: row.id, name: row.name, groupName: row.group.name, code: row.code }));
}
