import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { TAG_MAX_PER_GROUP } from "@/lib/constants";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { resolveTag } from "@/lib/resolve";
import { ancestorPathsOf } from "@/lib/scope";
import type {
  CreateTagInput,
  DeleteTagInput,
  RecolorTagInput,
  RenameKeyInput,
  RenameValueInput,
} from "@/lib/validation/tag";

// Tag definitions: create, rename, recolor, soft delete (DESIGN.md §13, design D2). Every mutation
// checks naming rules and writes its audit entry inside the same transaction.

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
type Owner = { id: number; path: string };

const snapshot = (tag: { id: number; key: string; value: string | null; color: string }) => ({
  id: tag.id,
  key: tag.key,
  value: tag.value,
  color: tag.color,
});

/** Non-deleted tags with this key owned by `owner` or any of its ancestors. */
function sameKeyOnChain(tx: Tx, owner: Owner, key: string) {
  return tx.tag.findMany({
    where: { key, group: { path: { in: ancestorPathsOf(owner.path) } } },
    include: { group: { select: { id: true, name: true } } },
  });
}

/** Rejects `key` when an ancestor owns it, naming the owner (a descendant may not add to an ancestor's key). */
function assertNotOwnedAbove(owner: Owner, key: string, chain: Awaited<ReturnType<typeof sameKeyOnChain>>) {
  const above = chain.find((tag) => tag.groupId !== owner.id);
  if (above) throw new ValidationError(`Kunci "${key}" sudah dipakai oleh ${above.group.name}`);
}

/** All non-deleted rows of the tag's key in its owner group (just the tag itself for a simple tag). */
function keyRows(tx: Tx, tag: { groupId: number; key: string }) {
  return tx.tag.findMany({ where: { groupId: tag.groupId, key: tag.key }, orderBy: { id: "asc" } });
}

export async function createTag(session: SessionUser, input: CreateTagInput) {
  // The owner is always the creator's group, never taken from the client.
  const owner: Owner = { id: session.groupId, path: session.groupPath };
  authorize(session, "tag.manage", { groupId: owner.id });

  const actorId = Number(session.id);
  return db.$transaction(async (tx) => {
    const chain = await sameKeyOnChain(tx, owner, input.key);
    assertNotOwnedAbove(owner, input.key, chain);

    // Everything left in `chain` is this group's own rows for the key.
    if (input.value === null && chain.length > 0) {
      throw new ValidationError(`Tag "${input.key}" sudah ada`);
    }
    if (input.value !== null) {
      if (chain.some((tag) => tag.value === null)) {
        throw new ValidationError(`"${input.key}" sudah ada sebagai tag tanpa nilai`);
      }
      if (chain.some((tag) => tag.value === input.value)) {
        throw new ValidationError(`Tag "${input.key}:${input.value}" sudah ada`);
      }
    }
    if ((await tx.tag.count({ where: { groupId: owner.id } })) >= TAG_MAX_PER_GROUP) {
      throw new ValidationError(`Satu grup maksimal memiliki ${TAG_MAX_PER_GROUP} tag`);
    }

    const tag = await tx.tag.create({
      data: { groupId: owner.id, key: input.key, value: input.value, color: input.color, createdById: actorId },
    });
    await audit(tx, {
      actorId,
      action: "tag.create",
      entity: "Tag",
      entityId: tag.id,
      groupId: owner.id,
      after: { key: tag.key, value: tag.value, color: tag.color },
    });
    return tag;
  });
}

export async function recolorTag(session: SessionUser, input: RecolorTagInput) {
  const tag = await resolveTag(session, input.tagId);
  authorize(session, "tag.manage", { groupId: tag.groupId });
  if (tag.color === input.color) return tag;

  return db.$transaction(async (tx) => {
    const updated = await tx.tag.update({ where: { id: tag.id }, data: { color: input.color } });
    await audit(tx, {
      actorId: Number(session.id),
      action: "tag.update",
      entity: "Tag",
      entityId: tag.id,
      groupId: tag.groupId,
      before: [snapshot(tag)],
      after: [snapshot(updated)],
    });
    return updated;
  });
}

/** Renames the key on every value of the tag's key (or on the one simple tag), as a single audit entry. */
export async function renameTagKey(session: SessionUser, input: RenameKeyInput) {
  const tag = await resolveTag(session, input.tagId);
  authorize(session, "tag.manage", { groupId: tag.groupId });

  return db.$transaction(async (tx) => {
    const rows = await keyRows(tx, tag);
    if (input.newKey === tag.key) return rows;

    const clash = await sameKeyOnChain(tx, tag.group, input.newKey);
    assertNotOwnedAbove(tag.group, input.newKey, clash);
    if (clash.length > 0) throw new ValidationError(`Tag "${input.newKey}" sudah ada`);

    await tx.tag.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { key: input.newKey } });
    const updated = await tx.tag.findMany({ where: { id: { in: rows.map((row) => row.id) } }, orderBy: { id: "asc" } });
    await audit(tx, {
      actorId: Number(session.id),
      action: "tag.update",
      entity: "Tag",
      entityId: rows[0].id,
      groupId: tag.groupId,
      before: rows.map(snapshot),
      after: updated.map(snapshot),
    });
    return updated;
  });
}

export async function renameTagValue(session: SessionUser, input: RenameValueInput) {
  const tag = await resolveTag(session, input.tagId);
  authorize(session, "tag.manage", { groupId: tag.groupId });
  if (tag.value === null) throw new ValidationError("Tag ini tidak memiliki nilai");
  if (tag.value === input.newValue) return tag;

  return db.$transaction(async (tx) => {
    const siblings = await keyRows(tx, tag);
    if (siblings.some((row) => row.value === input.newValue)) {
      throw new ValidationError(`Tag "${tag.key}:${input.newValue}" sudah ada`);
    }

    const updated = await tx.tag.update({ where: { id: tag.id }, data: { value: input.newValue } });
    await audit(tx, {
      actorId: Number(session.id),
      action: "tag.update",
      entity: "Tag",
      entityId: tag.id,
      groupId: tag.groupId,
      before: [snapshot(tag)],
      after: [snapshot(updated)],
    });
    return updated;
  });
}

async function softDelete(session: SessionUser, input: DeleteTagInput, wholeKey: boolean) {
  const tag = await resolveTag(session, input.tagId);
  authorize(session, "tag.manage", { groupId: tag.groupId });

  return db.$transaction(async (tx) => {
    const rows = wholeKey ? await keyRows(tx, tag) : [tag];
    await tx.tag.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { deletedAt: new Date() } });
    await audit(tx, {
      actorId: Number(session.id),
      action: "tag.delete",
      entity: "Tag",
      entityId: rows[0].id,
      groupId: tag.groupId,
      before: rows.map(snapshot),
    });
    return rows;
  });
}

/** Soft-deletes one tag (a simple tag, or one value of a key). Its links stay but stop being shown. */
export async function deleteTag(session: SessionUser, input: DeleteTagInput) {
  const [deleted] = await softDelete(session, input, false);
  return deleted;
}

/** Soft-deletes the tag's whole key: every value in the owner group. */
export function deleteTagKey(session: SessionUser, input: DeleteTagInput) {
  return softDelete(session, input, true);
}
