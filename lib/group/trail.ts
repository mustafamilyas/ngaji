import { db } from "@/lib/db";
import { ancestorPathsOf, isInScope } from "@/lib/scope";

export type GroupTrailItem = { id: number; name: string; href?: string };

/**
 * The group at `path` and its ancestors, root first, for breadcrumbs. Only
 * groups inside the viewer's scope get a link — an ancestor above it is
 * shown by name (as on the check-in page) but its page would 404.
 */
export async function groupTrail(scopePath: string, path: string): Promise<GroupTrailItem[]> {
  const groups = await db.group.findMany({
    where: { path: { in: ancestorPathsOf(path) } },
    orderBy: { depth: "asc" },
    select: { id: true, name: true, path: true },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    href: isInScope(g.path, scopePath) ? `/grup/${g.id}` : undefined,
  }));
}
