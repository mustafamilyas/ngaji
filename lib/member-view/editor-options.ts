import type { SessionUser } from "@/lib/auth/session-user";
import { VIEW_GROUP_OPTIONS_LIMIT, VIEW_TAG_OPTIONS_LIMIT } from "@/lib/constants";
import { db } from "@/lib/db";
import { getLevels } from "@/lib/group/levels";
import { visibleTagWhere } from "@/lib/tag/access";

export type GroupOption = { id: number; label: string };
export type LevelOption = { depth: number; name: string };
/** A tag the viewer can see; `label` is `key` or `key:value`. */
export type TagOption = { id: number; label: string };
export type EditorOptions = { groups: GroupOption[]; levels: LevelOption[]; tags: TagOption[] };

/**
 * What the view editor may offer: the viewer's in-scope, non-deleted groups
 * (for the "Grup" rule) and the org levels from the viewer's own level down
 * (for "kelompokkan menurut tingkat") and the tags they can see (for the "Tag" rule). All are only suggestions — the
 * definition is re-validated on every load and save.
 */
export async function loadEditorOptions(session: SessionUser): Promise<EditorOptions> {
  const own = await db.group.findUnique({ where: { id: session.groupId }, select: { organizationId: true, depth: true } });
  if (!own) return { groups: [], levels: [], tags: [] };

  const [groups, levels, tags] = await Promise.all([
    db.group.findMany({
      where: { deletedAt: null, path: { startsWith: session.groupPath } },
      orderBy: [{ depth: "asc" }, { name: "asc" }],
      take: VIEW_GROUP_OPTIONS_LIMIT,
      select: { id: true, name: true, parent: { select: { name: true } } },
    }),
    getLevels(own.organizationId),
    db.tag.findMany({
      where: visibleTagWhere(session),
      orderBy: [{ key: "asc" }, { value: "asc" }, { id: "asc" }],
      take: VIEW_TAG_OPTIONS_LIMIT,
      select: { id: true, key: true, value: true },
    }),
  ]);

  return {
    groups: groups.map((g) => ({ id: g.id, label: g.parent ? `${g.parent.name} › ${g.name}` : g.name })),
    tags: tags.map((t) => ({ id: t.id, label: t.value === null ? t.key : `${t.key}:${t.value}` })),
    levels: levels.filter((l) => l.depth >= own.depth).map((l) => ({ depth: l.depth, name: l.name })),
  };
}
