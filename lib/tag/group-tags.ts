import { db } from "@/lib/db";
import type { TagSummary } from "./include";

export type GroupTag = TagSummary & {
  /** Live members / activities that carry the tag; only present when counts were asked for. */
  members?: number;
  activities?: number;
};

/** One key of the owner group: a simple tag alone, or the values of a key. */
export type GroupTagKey = { key: string; tags: GroupTag[] };

/**
 * The non-deleted tags a group owns, grouped by key (for its Tag tab). The caller has already resolved the
 * group in the user's scope, and a visible group's own tags are visible (design D3). Counts are for managers,
 * who see the whole subtree and the activities of their ancestors, so they never reveal anything out of view.
 */
export async function loadGroupTags(groupId: number, options: { withCounts: boolean }): Promise<GroupTagKey[]> {
  const rows = await db.tag.findMany({
    where: { groupId },
    select: { id: true, groupId: true, key: true, value: true, color: true },
  });
  const ids = rows.map((row) => row.id);

  const [memberCounts, activityCounts] =
    options.withCounts && ids.length > 0
      ? await Promise.all([
          db.memberTag.groupBy({ by: ["tagId"], where: { tagId: { in: ids }, member: { deletedAt: null } }, _count: { _all: true } }),
          db.activityTag.groupBy({ by: ["tagId"], where: { tagId: { in: ids }, activity: { deletedAt: null } }, _count: { _all: true } }),
        ])
      : [null, null];
  const members = new Map(memberCounts?.map((row) => [row.tagId, row._count._all]));
  const activities = new Map(activityCounts?.map((row) => [row.tagId, row._count._all]));

  const byKey = new Map<string, GroupTag[]>();
  for (const row of rows) {
    const tag: GroupTag = options.withCounts ? { ...row, members: members.get(row.id) ?? 0, activities: activities.get(row.id) ?? 0 } : row;
    byKey.set(row.key, [...(byKey.get(row.key) ?? []), tag]);
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "id-ID"))
    .map(([key, tags]) => ({ key, tags: tags.sort((a, b) => (a.value ?? "").localeCompare(b.value ?? "", "id-ID")) }));
}
