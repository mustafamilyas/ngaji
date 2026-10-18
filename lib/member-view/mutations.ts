import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import type { Prisma } from "@/lib/generated/prisma/client";
import { resolveDefinitionGroupsStrict, resolveMemberView } from "@/lib/resolve";
import type { CreateMemberViewInput, Definition, MemberViewIdInput, UpdateMemberViewInput } from "@/lib/validation/member-view";

/** A validated definition is plain JSON; `Rule.value` is typed `unknown`, which Prisma's Json input rejects. */
const toJson = (definition: Definition) => definition as unknown as Prisma.InputJsonValue;

/**
 * Names are unique per group among non-deleted views, case-insensitively
 * (member-views spec). SQLite `equals` is case-sensitive, so the group's names
 * are compared in code; a group has few views.
 */
async function assertNameAvailable(groupId: number, name: string, exceptViewId?: number): Promise<void> {
  const wanted = name.trim().toLowerCase();
  const views = await db.memberView.findMany({ where: { groupId }, select: { id: true, name: true } });
  if (views.some((v) => v.id !== exceptViewId && v.name.trim().toLowerCase() === wanted)) {
    throw new ValidationError(`Tampilan "${name}" sudah ada`);
  }
}

export async function createMemberView(session: SessionUser, input: CreateMemberViewInput) {
  // The owning group is always the creator's, never taken from the client.
  const groupId = session.groupId;
  authorize(session, "member_view.create", { groupId });
  await resolveDefinitionGroupsStrict(session, input.definition);
  await assertNameAvailable(groupId, input.name);

  const actorId = Number(session.id);
  return db.$transaction(async (tx) => {
    const view = await tx.memberView.create({
      data: {
        groupId,
        ownerId: actorId,
        createdById: actorId,
        name: input.name,
        source: input.source,
        visibility: input.visibility,
        definition: toJson(input.definition),
      },
    });
    await audit(tx, {
      actorId,
      action: "member_view.create",
      entity: "MemberView",
      entityId: view.id,
      groupId,
      after: { name: view.name, source: view.source, visibility: view.visibility, definition: input.definition },
    });
    return view;
  });
}

export async function updateMemberView(session: SessionUser, input: UpdateMemberViewInput) {
  const view = await resolveMemberView(session, input.viewId);
  authorize(session, "member_view.update", view);
  if (input.definition) await resolveDefinitionGroupsStrict(session, input.definition);
  if (input.name !== undefined) await assertNameAvailable(view.groupId, input.name, view.id);

  return db.$transaction(async (tx) => {
    const updated = await tx.memberView.update({
      where: { id: view.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.definition && { definition: toJson(input.definition) }),
      },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "member_view.update",
      entity: "MemberView",
      entityId: view.id,
      groupId: view.groupId,
      before: { name: view.name, definition: view.definition },
      after: { name: updated.name, definition: updated.definition },
    });
    return updated;
  });
}

export async function deleteMemberView(session: SessionUser, input: MemberViewIdInput) {
  const view = await resolveMemberView(session, input.viewId);
  authorize(session, "member_view.delete", view);

  return db.$transaction(async (tx) => {
    const deleted = await tx.memberView.update({
      where: { id: view.id },
      data: { deletedAt: new Date() },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "member_view.delete",
      entity: "MemberView",
      entityId: view.id,
      groupId: view.groupId,
      before: {
        name: view.name,
        source: view.source,
        visibility: view.visibility,
        ownerId: view.ownerId,
        createdById: view.createdById,
        definition: view.definition,
      },
    });
    return deleted;
  });
}

/** Takeover of an orphaned view by an ADMIN/OWNER of its group; `authorize` enforces both. */
export async function transferMemberView(session: SessionUser, input: MemberViewIdInput) {
  const view = await resolveMemberView(session, input.viewId);
  authorize(session, "member_view.transfer", view);

  const toOwnerId = Number(session.id);
  return db.$transaction(async (tx) => {
    const updated = await tx.memberView.update({
      where: { id: view.id },
      data: { ownerId: toOwnerId },
    });
    await audit(tx, {
      actorId: toOwnerId,
      action: "member_view.transfer",
      entity: "MemberView",
      entityId: view.id,
      groupId: view.groupId,
      meta: { fromOwnerId: view.ownerId, toOwnerId },
    });
    return updated;
  });
}
