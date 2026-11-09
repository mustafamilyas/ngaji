import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { RELATION_MAX_PER_MEMBER } from "@/lib/constants";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Tx } from "@/lib/member/mutations";
import { canonicalPair } from "@/lib/member/relations";
import { resolveMember } from "@/lib/resolve";
import type { LinkMembersInput, UnlinkMembersInput } from "@/lib/validation/member-relation";

/** Resolves both members (404 if deleted, out of scope or in another organization) and checks `member.relate`. */
async function resolvePair(session: SessionUser, firstId: number, secondId: number) {
  const first = await resolveMember(session, firstId);
  const second = await resolveMember(session, secondId);
  authorize(session, "member.relate", { groupPath: first.group.path, relativeGroupPath: second.group.path });
  return [first, second] as const;
}

/** Links the Keluarga section shows: the other member is not soft-deleted. */
function visibleRelationCount(tx: Tx, memberId: number) {
  return tx.memberRelation.count({
    where: {
      OR: [
        { fromMemberId: memberId, toMember: { deletedAt: null } },
        { toMemberId: memberId, fromMember: { deletedAt: null } },
      ],
    },
  });
}

export async function linkMembers(session: SessionUser, input: LinkMembersInput) {
  const [from, to] = await resolvePair(session, input.fromMemberId, input.toMemberId);
  if (from.id === to.id) throw new ValidationError("Anggota tidak bisa dihubungkan dengan dirinya sendiri");
  const pair = canonicalPair(input.type, from.id, to.id);
  const actorId = Number(session.id);

  // Checked inside the transaction: SQLite serializes writers, so no concurrent link can slip in between.
  return db.$transaction(async (tx) => {
    const existing = await tx.memberRelation.findFirst({
      where: {
        OR: [
          { fromMemberId: from.id, toMemberId: to.id },
          { fromMemberId: to.id, toMemberId: from.id },
        ],
      },
      select: { id: true },
    });
    if (existing) throw new ValidationError("Kedua anggota sudah memiliki hubungan");
    for (const memberId of [from.id, to.id]) {
      if ((await visibleRelationCount(tx, memberId)) >= RELATION_MAX_PER_MEMBER) {
        throw new ValidationError(`Satu anggota paling banyak memiliki ${RELATION_MAX_PER_MEMBER} hubungan keluarga`);
      }
    }

    const relation = await tx.memberRelation.create({ data: { ...pair, type: input.type, createdById: actorId } });
    await audit(tx, {
      actorId,
      action: "member.relate",
      entity: "MemberRelation",
      entityId: relation.id,
      groupId: pair.fromMemberId === from.id ? from.groupId : to.groupId,
      meta: { ...pair, type: input.type },
    });
    return relation;
  });
}

/** Deletes a link permanently (link rows are hard-deleted, like `MemberTag`). Returns the deleted row. */
export async function unlinkMembers(session: SessionUser, input: UnlinkMembersInput) {
  const relation = await db.memberRelation.findUnique({ where: { id: input.relationId } });
  if (!relation) throw new NotFoundError();
  const [from] = await resolvePair(session, relation.fromMemberId, relation.toMemberId);

  return db.$transaction(async (tx) => {
    await tx.memberRelation.delete({ where: { id: relation.id } });
    await audit(tx, {
      actorId: Number(session.id),
      action: "member.unrelate",
      entity: "MemberRelation",
      entityId: relation.id,
      groupId: from.groupId,
      meta: { fromMemberId: relation.fromMemberId, toMemberId: relation.toMemberId, type: relation.type },
    });
    return relation;
  });
}
