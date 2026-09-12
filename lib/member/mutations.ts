import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { getMaxDepth } from "@/lib/group/levels";
import { resolveGroup, resolveMember } from "@/lib/resolve";
import type { CreateMemberInput, UpdateMemberInput } from "@/lib/validation/member";

/** DESIGN.md §2 "wajib grup daun": a member's group must be at the org's deepest configured depth. */
async function assertLeafGroup(group: { organizationId: number; depth: number }): Promise<void> {
  const maxDepth = await getMaxDepth(group.organizationId);
  if (group.depth !== maxDepth) {
    throw new ValidationError("Anggota hanya boleh berada di grup daun (jenjang terakhir)");
  }
}

export async function createMember(session: SessionUser, input: CreateMemberInput) {
  const group = await resolveGroup(session, input.groupId);
  authorize(session, "member.create", { groupPath: group.path });
  await assertLeafGroup(group);

  return db.$transaction(async (tx) => {
    const member = await tx.member.create({
      data: {
        groupId: group.id,
        name: input.name,
        birthPlace: input.birthPlace,
        birthDate: input.birthDate,
        sex: input.sex,
        address: input.address,
        phone: input.phone,
        maritalStatus: input.maritalStatus,
        workStatus: input.workStatus,
        email: input.email ?? null,
        status: input.status,
        joinedAt: input.joinedAt,
        exitedAt: input.exitedAt ?? null,
        createdById: Number(session.id),
      },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "member.create",
      entity: "Member",
      entityId: member.id,
      groupId: member.groupId,
      after: member,
    });
    return member;
  });
}

export async function updateMember(session: SessionUser, input: UpdateMemberInput) {
  const { group, ...before } = await resolveMember(session, input.memberId);
  authorize(session, "member.update", { groupPath: group.path });

  return db.$transaction(async (tx) => {
    const updated = await tx.member.update({
      where: { id: before.id },
      data: {
        name: input.name,
        birthPlace: input.birthPlace,
        birthDate: input.birthDate,
        sex: input.sex,
        address: input.address,
        phone: input.phone,
        maritalStatus: input.maritalStatus,
        workStatus: input.workStatus,
        email: input.email ?? null,
        status: input.status,
        joinedAt: input.joinedAt,
        exitedAt: input.exitedAt ?? null,
      },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "member.update",
      entity: "Member",
      entityId: before.id,
      groupId: before.groupId,
      before,
      after: updated,
    });
    return updated;
  });
}

export async function deleteMember(session: SessionUser, memberId: number) {
  const member = await resolveMember(session, memberId);
  authorize(session, "member.delete", { groupPath: member.group.path });

  return db.$transaction(async (tx) => {
    const deleted = await tx.member.update({
      where: { id: member.id },
      data: { deletedAt: new Date() },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "member.delete",
      entity: "Member",
      entityId: member.id,
      groupId: member.groupId,
      before: { deletedAt: null },
      after: { deletedAt: deleted.deletedAt },
    });
    return deleted;
  });
}
