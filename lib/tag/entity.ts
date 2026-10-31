import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import type { TagTarget } from "@/lib/validation/tag";
import { visibleTagLinks, type TagSummary } from "./include";
import { listTags, type TagOwnerGroup } from "./list";

export type TagOptionsData = {
  /** Tags the user may attach (their group's and its ancestors'). */
  options: TagOwnerGroup[];
  /** ADMIN or OWNER may create a tag from the picker, in their own group. */
  canCreate: boolean;
};

/** Whether a picker is worth showing: a usable tag to choose, or the right to create one. */
export const canPickTags = ({ options, canCreate }: TagOptionsData) => options.length > 0 || canCreate;

/** What every picker on a page shares (list pages load it once and hand it to a `TagOptionsProvider`). */
export async function loadTagOptions(session: SessionUser): Promise<TagOptionsData> {
  const { usable } = await listTags(session);
  return { options: usable, canCreate: session.role === "ADMIN" || session.role === "OWNER" };
}

export type EntityTagsData = TagOptionsData & {
  target: TagTarget;
  /** The entity's tags the user may see, key then value. */
  attached: TagSummary[];
};

/**
 * Everything a detail page's tag row needs. The caller has already resolved the member or activity in the
 * user's scope, so a missing row here only means it vanished in between and yields no tags.
 */
export async function loadEntityTags(session: SessionUser, target: TagTarget): Promise<EntityTagsData> {
  const select = { tags: visibleTagLinks(session) };
  const [row, tagOptions] = await Promise.all([
    target.kind === "member"
      ? db.member.findUnique({ where: { id: target.id }, select })
      : db.activity.findUnique({ where: { id: target.id }, select }),
    loadTagOptions(session),
  ]);
  return { target, attached: row?.tags.map((link) => link.tag) ?? [], ...tagOptions };
}
