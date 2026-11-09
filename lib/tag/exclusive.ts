/** The fields of a tag that exclusivity looks at. */
export type LinkedTag = { id: number; groupId: number; key: string; value: string | null };

/**
 * Ids of tags already on an entity that attaching `next` must remove (design D4): key values are
 * exclusive per (owner group, key). Simple tags, and tags already attached, replace nothing.
 */
export function tagIdsReplacedBy(current: LinkedTag[], next: LinkedTag): number[] {
  if (next.value === null) return [];
  if (current.some((tag) => tag.id === next.id)) return [];
  return current
    .filter((tag) => tag.value !== null && tag.groupId === next.groupId && tag.key === next.key)
    .map((tag) => tag.id);
}
