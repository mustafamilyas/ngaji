import type { Prisma } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import type { Dimension } from "@/lib/validation/summary";
import { bucketWheres, type BucketWhere } from "./dimensions";

/**
 * DB-side counting shared by view grouping (`lib/member-view/sections.ts`) and
 * summaries, so the two cannot drift. Every counter takes the already
 * scope-filtered population `where` and never loads member rows.
 */

type MemberWhere = Prisma.MemberWhereInput;

export type CountedBucket = BucketWhere & { count: number };

/** Depth of the viewer's group: its path holds one id per level, root = depth 0. */
export function depthOf(groupPath: string): number {
  return groupPath.split("/").filter(Boolean).length - 1;
}

/** One `groupBy` for the whole property; every enum value in display order, zero counts included. */
export async function countByProperty(
  where: MemberWhere,
  dimension: Extract<Dimension, { kind: "property" }>,
  today: string,
): Promise<CountedBucket[]> {
  const field = dimension.field;
  const rows = await db.member.groupBy({ by: [field], where, _count: { _all: true } });
  const counts = new Map(rows.map((row) => [row[field] as string, row._count._all]));
  return bucketWheres(dimension, today).map((b) => ({ ...b, count: counts.get(b.key.slice(2)) ?? 0 }));
}

/** One `count` per bucket plus "Lainnya" (members outside every bucket). */
export async function countByAgeBuckets(
  where: MemberWhere,
  dimension: Extract<Dimension, { kind: "ageBuckets" }>,
  today: string,
): Promise<CountedBucket[]> {
  const buckets = bucketWheres(dimension, today);
  const counts = await Promise.all(buckets.map((b) => db.member.count({ where: { AND: [where, b.where] } })));
  return buckets.map((b, i) => ({ ...b, count: counts[i] }));
}

/**
 * Org-level buckets: members are counted per leaf group in one query, then
 * rolled up to their ancestor at `depth` using the id at that position in the
 * group path. Levels below the leaf level have no ancestor and yield nothing;
 * only ancestors that hold members appear. Rejecting levels above the viewer
 * is the caller's job (`depthOf`).
 */
export async function countByGroupLevel(
  where: MemberWhere,
  dimension: Extract<Dimension, { kind: "groupLevel" }>,
): Promise<CountedBucket[]> {
  const rows = await db.member.groupBy({ by: ["groupId"], where, _count: { _all: true } });
  if (rows.length === 0) return [];

  const memberGroups = await db.group.findMany({
    where: { id: { in: rows.map((r) => r.groupId) } },
    select: { id: true, path: true },
  });
  const pathOf = new Map(memberGroups.map((g) => [g.id, g.path]));

  const countByAncestor = new Map<number, number>();
  for (const row of rows) {
    const ancestorId = Number(pathOf.get(row.groupId)?.split("/").filter(Boolean)[dimension.depth]);
    if (!Number.isInteger(ancestorId)) continue;
    countByAncestor.set(ancestorId, (countByAncestor.get(ancestorId) ?? 0) + row._count._all);
  }
  if (countByAncestor.size === 0) return [];

  const ancestors = await db.group.findMany({
    where: { id: { in: [...countByAncestor.keys()] }, deletedAt: null },
    select: { id: true, name: true, path: true },
  });
  return ancestors
    .sort((a, b) => a.name.localeCompare(b.name, "id") || a.id - b.id)
    .map((g) => ({
      key: `g:${g.id}`,
      label: g.name,
      count: countByAncestor.get(g.id)!,
      where: { group: { path: { startsWith: g.path } } },
    }));
}
