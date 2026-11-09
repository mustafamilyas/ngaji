import { randomUUID } from "node:crypto";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { IMPORT_TRANSACTION_TIMEOUT_MS, MAX_IMPORT_ROWS, MEMBER_CODE_MAX_ATTEMPTS } from "@/lib/constants";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { ValidationError } from "@/lib/errors";
import { getMaxDepth } from "@/lib/group/levels";
import { generateMemberCode } from "@/lib/member/code";
import { resolveGroup, resolveMember } from "@/lib/resolve";
import type { CreateMemberInput, UpdateMemberInput } from "@/lib/validation/member";

/** DESIGN.md §2 "wajib grup daun": a member's group must be at the org's deepest configured depth. */
export async function assertLeafGroup(group: { organizationId: number; depth: number }): Promise<void> {
  const maxDepth = await getMaxDepth(group.organizationId);
  if (group.depth !== maxDepth) {
    throw new ValidationError("Anggota hanya boleh berada di grup daun (jenjang terakhir)");
  }
}

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * `count` distinct member codes not used by any member, including soft-deleted ones (member-code spec).
 * Taken codes are regenerated, one query per round; the unique index on `Member.code` is the backstop.
 * An organization without a prefix is a deploy error (backfill not run): thrown as a plain Error, logged by `runAction`.
 */
export async function newMemberCodes(tx: Tx, organizationId: number, count: number): Promise<string[]> {
  const { memberCodePrefix: prefix } = await tx.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { memberCodePrefix: true },
  });
  if (!prefix) throw new Error(`Organization ${organizationId} has no member code prefix`);

  const codes = new Set<string>();
  for (let attempt = 0; attempt < MEMBER_CODE_MAX_ATTEMPTS && codes.size < count; attempt++) {
    const candidates = new Set<string>();
    while (candidates.size < count - codes.size) {
      const code = generateMemberCode(prefix);
      if (!codes.has(code)) candidates.add(code);
    }
    // Raw SQL: `lib/db.ts` hides soft-deleted members, whose codes must not be reused either.
    const taken = await tx.$queryRaw<{ code: string }[]>`
      SELECT code FROM Member WHERE code IN (${Prisma.join([...candidates])})`;
    const takenCodes = new Set(taken.map((member) => member.code));
    for (const code of candidates) if (!takenCodes.has(code)) codes.add(code);
  }
  if (codes.size < count) throw new Error(`No free member code after ${MEMBER_CODE_MAX_ATTEMPTS} attempts`);
  return [...codes];
}

function newMemberData(input: CreateMemberInput, groupId: number, actorId: number, code: string) {
  return {
    groupId,
    code,
    name: input.name,
    birthPlace: input.birthPlace,
    birthDate: input.birthDate,
    sex: input.sex,
    address: input.address,
    phone: input.phone ?? null,
    maritalStatus: input.maritalStatus,
    workStatus: input.workStatus,
    email: input.email ?? null,
    status: input.status,
    joinedAt: input.joinedAt,
    exitedAt: input.exitedAt ?? null,
    createdById: actorId,
  };
}

export async function createMember(session: SessionUser, input: CreateMemberInput) {
  const group = await resolveGroup(session, input.groupId);
  authorize(session, "member.create", { groupPath: group.path });
  await assertLeafGroup(group);

  return db.$transaction(async (tx) => {
    const [code] = await newMemberCodes(tx, group.organizationId, 1);
    const member = await tx.member.create({ data: newMemberData(input, group.id, Number(session.id), code) });
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

/**
 * Creates many members in one transaction (member-csv-import). Each distinct group is resolved,
 * authorized and checked once, before anything is written; any failure rolls back every member and audit entry.
 * All audit entries share `meta.importId`.
 */
export async function importMembers(session: SessionUser, rows: readonly CreateMemberInput[]) {
  if (rows.length === 0) throw new ValidationError("Tidak ada anggota untuk diimpor");
  if (rows.length > MAX_IMPORT_ROWS) throw new ValidationError("Jumlah baris melebihi batas impor");

  let organizationId = 0; // every resolved group is in the caller's organization
  for (const groupId of new Set(rows.map((row) => row.groupId))) {
    const group = await resolveGroup(session, groupId);
    authorize(session, "member.create", { groupPath: group.path });
    await assertLeafGroup(group);
    organizationId = group.organizationId;
  }

  const actorId = Number(session.id);
  const importId = randomUUID();
  await db.$transaction(
    async (tx) => {
      const codes = await newMemberCodes(tx, organizationId, rows.length);
      for (const [i, row] of rows.entries()) {
        const member = await tx.member.create({ data: newMemberData(row, row.groupId, actorId, codes[i]) });
        await audit(tx, {
          actorId,
          action: "member.create",
          entity: "Member",
          entityId: member.id,
          groupId: member.groupId,
          after: member,
          meta: { importId },
        });
      }
    },
    { timeout: IMPORT_TRANSACTION_TIMEOUT_MS },
  );
  return { created: rows.length, importId };
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
        phone: input.phone ?? null,
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
