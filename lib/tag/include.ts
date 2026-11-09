import { visibleTagWhere } from "./access";
import type { SessionUser } from "@/lib/auth/session-user";

/** What a chip needs to render and filter; owner group name is looked up separately where a label wants it. */
export type TagSummary = { id: number; groupId: number; key: string; value: string | null; color: string };

const tagSummarySelect = { id: true, groupId: true, key: true, value: true, color: true } as const;

/**
 * Prisma args for `include: { tags: … }` on `Member`/`Activity`: only links to tags the user may see, in a
 * stable key-then-value order. The soft-delete extension does not reach nested includes, so deleted tags
 * are excluded by `visibleTagWhere` here.
 */
export function visibleTagLinks(user: Pick<SessionUser, "groupPath">) {
  return {
    where: { tag: visibleTagWhere(user) },
    select: { tag: { select: tagSummarySelect } },
    orderBy: [{ tag: { key: "asc" as const } }, { tag: { value: "asc" as const } }],
  };
}
