import type { SessionUser } from "@/lib/auth/session-user";
import { VIEW_GROUP_OPTIONS_LIMIT } from "@/lib/constants";
import { db } from "@/lib/db";
import { getLevels } from "@/lib/group/levels";

export type GroupOption = { id: number; label: string };
export type LevelOption = { depth: number; name: string };
export type EditorOptions = { groups: GroupOption[]; levels: LevelOption[] };

/**
 * What the view editor may offer: the viewer's in-scope, non-deleted groups
 * (for the "Grup" rule) and the org levels from the viewer's own level down
 * (for "kelompokkan menurut tingkat"). Both are only suggestions — the
 * definition is re-validated on every load and save.
 */
export async function loadEditorOptions(session: SessionUser): Promise<EditorOptions> {
  const own = await db.group.findUnique({ where: { id: session.groupId }, select: { organizationId: true, depth: true } });
  if (!own) return { groups: [], levels: [] };

  const [groups, levels] = await Promise.all([
    db.group.findMany({
      where: { deletedAt: null, path: { startsWith: session.groupPath } },
      orderBy: [{ depth: "asc" }, { name: "asc" }],
      take: VIEW_GROUP_OPTIONS_LIMIT,
      select: { id: true, name: true, parent: { select: { name: true } } },
    }),
    getLevels(own.organizationId),
  ]);

  return {
    groups: groups.map((g) => ({ id: g.id, label: g.parent ? `${g.parent.name} › ${g.name}` : g.name })),
    levels: levels.filter((l) => l.depth >= own.depth).map((l) => ({ depth: l.depth, name: l.name })),
  };
}
