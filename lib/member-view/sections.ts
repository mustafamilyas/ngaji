import type { Prisma } from "@/lib/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/session-user";
import { VIEW_EXPANDED_SECTIONS, VIEW_SECTION_PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { today as todayIn } from "@/lib/dates";
import { countByAgeBuckets, countByGroupLevel, countByProperty, depthOf, type CountedBucket } from "@/lib/summary/count";
import type { Definition } from "@/lib/validation/member-view";
import { buildOrderBy } from "./query";
import { prepareView, type PreparedView } from "./results";

type MemberWhere = Prisma.MemberWhereInput;

/**
 * A section as computed on the server: `where` narrows the view's result set to
 * the section and never leaves this module (the client only sends back `key`).
 */
type ComputedSection = { key: string; label: string; count: number; where: MemberWhere };

/** What the page renders for one section. */
export type SectionView = {
  /** Stable id echoed back to `loadSectionMembers`: `p:<value>`, `a:<bucket index>` / `a:other`, `g:<group id>`. */
  key: string;
  label: string;
  count: number;
  /** Starts expanded (the first `VIEW_EXPANDED_SECTIONS` sections). */
  expanded: boolean;
  /** `members` holds the first page; false for collapsed sections, which the client loads on first expand. */
  loaded: boolean;
  members: SectionMember[];
  hasMore: boolean;
};

type SectionMember = Awaited<ReturnType<typeof findSectionMembers>>[number];

export type ViewSectionsResult =
  | { grouped: false; dropped: boolean; levelInvalid?: boolean }
  | { grouped: true; dropped: boolean; sections: SectionView[] };

/** Counting lives in `lib/summary/count.ts`; sections only drop empty buckets. */
function nonEmpty(buckets: CountedBucket[]): ComputedSection[] {
  return buckets.filter((b) => b.count > 0).map(({ key, label, count, where }) => ({ key, label, count, where }));
}

/** `null` = the grouping cannot apply for this viewer (org level above their own group). */
async function computeSections(session: SessionUser, prepared: PreparedView): Promise<ComputedSection[] | null> {
  const groupBy = prepared.definition.groupBy;
  if (!groupBy) return null;
  switch (groupBy.kind) {
    case "property":
      return nonEmpty(await countByProperty(prepared.where, groupBy, prepared.today));
    case "ageBuckets":
      return nonEmpty(await countByAgeBuckets(prepared.where, groupBy, prepared.today));
    case "groupLevel":
      if (groupBy.depth < depthOf(session.groupPath)) return null;
      return nonEmpty(await countByGroupLevel(prepared.where, groupBy));
  }
}

function findSectionMembers(prepared: PreparedView, section: ComputedSection, offset: number) {
  return db.member.findMany({
    where: { AND: [prepared.where, section.where] },
    orderBy: buildOrderBy(prepared.definition.sort),
    skip: offset,
    take: VIEW_SECTION_PAGE_SIZE,
    select: prepared.select,
  });
}

/**
 * Grouped result for a view definition: every non-empty section with its count,
 * and the first page of members for the first `VIEW_EXPANDED_SECTIONS` sections.
 * Collapsed sections come back with counts only (`loaded: false`).
 */
export async function listViewSections(
  session: SessionUser,
  definition: Definition,
  options: { today?: string } = {},
): Promise<ViewSectionsResult> {
  const prepared = await prepareView(session, definition, options.today ?? todayIn(session.timeZone));
  const { dropped } = prepared;
  if (!prepared.definition.groupBy) return { grouped: false, dropped };

  const computed = await computeSections(session, prepared);
  if (!computed) return { grouped: false, dropped, levelInvalid: true };

  const sections = await Promise.all(
    computed.map(async (section, index): Promise<SectionView> => {
      const expanded = index < VIEW_EXPANDED_SECTIONS;
      const members = expanded ? await findSectionMembers(prepared, section, 0) : [];
      return {
        key: section.key,
        label: section.label,
        count: section.count,
        expanded,
        loaded: expanded,
        members,
        hasMore: members.length < section.count,
      };
    }),
  );
  return { grouped: true, dropped, sections };
}

/**
 * One page of one section, for "Tampilkan lebih banyak" and first expand of a
 * collapsed section. The section is re-derived from the definition and `key`
 * on every call, so an unknown or out-of-scope key yields `null` (→ 404).
 */
export async function loadSectionMembers(
  session: SessionUser,
  definition: Definition,
  key: string,
  offset: number,
  options: { today?: string } = {},
) {
  const prepared = await prepareView(session, definition, options.today ?? todayIn(session.timeZone));
  const computed = await computeSections(session, prepared);
  const section = computed?.find((s) => s.key === key);
  if (!section) return null;

  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  const members = await findSectionMembers(prepared, section, safeOffset);
  return { members, count: section.count, hasMore: safeOffset + members.length < section.count };
}
