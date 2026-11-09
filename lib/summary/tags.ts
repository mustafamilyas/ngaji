import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { visibleTagWhere } from "@/lib/tag/access";
import type { TagValue } from "./dimensions";

/** A visible tag resolved for counting: a simple tag, or a key with its visible values. */
export type ResolvedTag =
  | { kind: "tag"; tagId: number; label: string }
  | { kind: "tagKey"; tagId: number; label: string; values: TagValue[] };

/**
 * Resolves a client-supplied tag id for counting. Anything the viewer cannot
 * use (unknown, soft-deleted, other organization, not visible) yields `null`,
 * never an error. For a key–value tag the id is an anchor: the key's other
 * visible, non-deleted values are loaded with it (member-summaries design D2).
 */
export async function resolveVisibleTag(session: SessionUser, tagId: number): Promise<ResolvedTag | null> {
  if (!Number.isInteger(tagId) || tagId <= 0) return null;
  const tag = await db.tag.findFirst({
    where: { AND: [{ id: tagId }, visibleTagWhere(session)] },
    select: { id: true, groupId: true, key: true, value: true },
  });
  if (!tag) return null;
  if (tag.value === null) return { kind: "tag", tagId: tag.id, label: tag.key };

  const siblings = await db.tag.findMany({
    where: { AND: [{ groupId: tag.groupId, key: tag.key, value: { not: null } }, visibleTagWhere(session)] },
    select: { id: true, value: true },
  });
  return {
    kind: "tagKey",
    tagId: tag.id,
    label: tag.key,
    values: siblings.map((s) => ({ id: s.id, value: s.value! })),
  };
}
