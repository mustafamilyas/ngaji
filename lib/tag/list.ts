import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { isAncestorOf } from "@/lib/scope";
import { canUseTag, visibleTagWhere } from "./access";
import type { TagSummary } from "./include";

/** One owner group and its tags, as the filter and the picker list them (UI groups values by key itself). */
export type TagOwnerGroup = {
  group: { id: number; name: string; isOwn: boolean };
  tags: TagSummary[];
};

type OwnerRow = { id: number; name: string; path: string; depth: number };

/** Own group first, then ancestors nearest-first, then descendants by depth and name. */
function compareOwners(userPath: string, a: OwnerRow, b: OwnerRow): number {
  const rank = (g: OwnerRow) => (g.path === userPath ? 0 : isAncestorOf(g.path, userPath) ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (rank(a) === 1) return b.depth - a.depth;
  return a.depth - b.depth || a.name.localeCompare(b.name, "id-ID");
}

/** Key, then value, with the simple tag (no value) before the values of the same key. */
function compareTags(a: TagSummary, b: TagSummary): number {
  return a.key.localeCompare(b.key, "id-ID") || (a.value ?? "").localeCompare(b.value ?? "", "id-ID");
}

/**
 * Tags the user sees (for the filter) and the subset they may attach (for the picker: owner is their group
 * or an ancestor), both grouped by owner group. Owners without a live tag are omitted.
 */
export async function listTags(session: SessionUser) {
  const rows = await db.tag.findMany({
    where: visibleTagWhere(session),
    select: {
      id: true,
      groupId: true,
      key: true,
      value: true,
      color: true,
      group: { select: { id: true, name: true, path: true, depth: true } },
    },
  });

  const byOwner = new Map<number, { owner: OwnerRow; tags: TagSummary[] }>();
  for (const { group, ...tag } of rows) {
    const entry = byOwner.get(group.id) ?? { owner: group, tags: [] };
    entry.tags.push(tag);
    byOwner.set(group.id, entry);
  }

  const visible: TagOwnerGroup[] = [...byOwner.values()]
    .sort((a, b) => compareOwners(session.groupPath, a.owner, b.owner))
    .map(({ owner, tags }) => ({
      group: { id: owner.id, name: owner.name, isOwn: owner.path === session.groupPath },
      tags: tags.sort(compareTags),
    }));
  const usablePaths = new Set([...byOwner.values()].filter(({ owner }) => canUseTag(session, owner.path)).map(({ owner }) => owner.id));
  const usable = visible.filter((entry) => usablePaths.has(entry.group.id));

  return { visible, usable };
}
