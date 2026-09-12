import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { resolveGroup } from "@/lib/resolve";
import type { CreateGroupInput, RenameGroupInput } from "@/lib/validation/group";

/**
 * Insert + materialized-path write in one transaction (DESIGN.md §2 "Catatan
 * model"): the row is created first (path unknown until it has an id), then
 * `path = parent.path + id + "/"` is written before the transaction commits,
 * so no reader ever observes a group with an empty path.
 */
export async function createGroup(session: SessionUser, input: CreateGroupInput) {
  const parent = await resolveGroup(session, input.parentId);
  authorize(session, "group.create", { groupPath: parent.path });

  const childLevel = await db.level.findUnique({
    where: { organizationId_depth: { organizationId: parent.organizationId, depth: parent.depth + 1 } },
  });
  if (!childLevel) {
    throw new ValidationError("Jenjang di bawah grup ini belum ada");
  }

  const sibling = await db.group.findFirst({
    where: { parentId: parent.id, name: input.name },
  });
  if (sibling) {
    throw new ValidationError(`Grup "${input.name}" sudah ada di bawah ${parent.name}`);
  }

  return db.$transaction(async (tx) => {
    const created = await tx.group.create({
      data: {
        organizationId: parent.organizationId,
        parentId: parent.id,
        depth: parent.depth + 1,
        name: input.name,
        path: "",
      },
    });
    const group = await tx.group.update({
      where: { id: created.id },
      data: { path: `${parent.path}${created.id}/` },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "group.create",
      entity: "Group",
      entityId: group.id,
      groupId: group.id,
      after: group,
    });
    return group;
  });
}

export async function renameGroup(session: SessionUser, input: RenameGroupInput) {
  const group = await resolveGroup(session, input.groupId);
  authorize(session, "group.update", { groupPath: group.path });

  if (input.name !== group.name) {
    const sibling = await db.group.findFirst({
      where: { parentId: group.parentId, name: input.name, NOT: { id: group.id } },
    });
    if (sibling) {
      throw new ValidationError(`Grup "${input.name}" sudah ada di grup yang sama`);
    }
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.group.update({
      where: { id: group.id },
      data: { name: input.name },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "group.update",
      entity: "Group",
      entityId: group.id,
      groupId: group.id,
      before: { name: group.name },
      after: { name: updated.name },
    });
    return updated;
  });
}

/**
 * "Kosong" (group-hierarchy spec) = no non-deleted children, members,
 * activities, or `UserGroupRole` rows — an inactive user still occupies
 * their `groupId`, so `isActive` is irrelevant here.
 */
export async function deleteGroup(session: SessionUser, groupId: number) {
  const group = await resolveGroup(session, groupId);
  authorize(session, "group.delete", { groupPath: group.path });

  const [childCount, memberCount, activityCount, userCount] = await Promise.all([
    db.group.count({ where: { parentId: group.id } }),
    db.member.count({ where: { groupId: group.id } }),
    db.activity.count({ where: { groupId: group.id } }),
    db.userGroupRole.count({ where: { groupId: group.id } }),
  ]);

  const attached: string[] = [];
  if (childCount > 0) attached.push("sub-grup");
  if (memberCount > 0) attached.push("anggota");
  if (activityCount > 0) attached.push("kegiatan");
  if (userCount > 0) attached.push("pengguna");
  if (attached.length > 0) {
    throw new ValidationError(`Tidak bisa menghapus grup: masih ada ${attached.join(", ")}`);
  }

  return db.$transaction(async (tx) => {
    const deleted = await tx.group.update({
      where: { id: group.id },
      data: { deletedAt: new Date() },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "group.delete",
      entity: "Group",
      entityId: group.id,
      groupId: group.id,
      before: { deletedAt: null },
      after: { deletedAt: deleted.deletedAt },
    });
    return deleted;
  });
}
