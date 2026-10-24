import type { Prisma } from "@/lib/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/session-user";
import { VIEW_EXPANDED_SECTIONS, VIEW_SECTION_PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { today as todayInJakarta } from "@/lib/dates";
import { DEFAULT_TIMEZONE } from "@/lib/validation/enums";
import { formatEnumLabel, MEMBER_STATUS_LABELS, SEX_LABELS } from "@/lib/member/labels";
import type { Definition, GroupBy } from "@/lib/validation/member-view";
import { MEMBER_VIEW_FIELDS } from "./fields";
import { ageRange } from "./age";
import { buildOrderBy } from "./query";
import { memberSelectFor, prepareView, type PreparedView } from "./results";

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

const OTHER_LABEL = "Lainnya";

/** Depth of the viewer's group: its path holds one id per level, root = depth 0. */
function depthOf(groupPath: string): number {
  return groupPath.split("/").filter(Boolean).length - 1;
}

function propertyLabel(field: string, value: string): string {
  if (field === "sex") return SEX_LABELS[value as keyof typeof SEX_LABELS] ?? value;
  if (field === "status") return MEMBER_STATUS_LABELS[value as keyof typeof MEMBER_STATUS_LABELS] ?? value;
  return formatEnumLabel(value);
}

async function propertySections(
  prepared: PreparedView,
  groupBy: Extract<GroupBy, { kind: "property" }>,
): Promise<ComputedSection[]> {
  const field = groupBy.field;
  const rows = await db.member.groupBy({ by: [field], where: prepared.where, _count: { _all: true } });
  const counts = new Map(rows.map((row) => [row[field] as string, row._count._all]));
  const values: readonly string[] = MEMBER_VIEW_FIELDS[field].values;
  return values
    .filter((value) => (counts.get(value) ?? 0) > 0)
    .map((value) => ({
      key: `p:${value}`,
      label: propertyLabel(field, value),
      count: counts.get(value)!,
      where: { [field]: value },
    }));
}

async function ageBucketSections(
  prepared: PreparedView,
  groupBy: Extract<GroupBy, { kind: "ageBuckets" }>,
): Promise<ComputedSection[]> {
  const bucketWheres: MemberWhere[] = groupBy.buckets.map((b) => ({ birthDate: ageRange(b.min, b.max, prepared.today) }));
  const candidates: Omit<ComputedSection, "count">[] = [
    ...groupBy.buckets.map((b, i) => ({ key: `a:${i}`, label: b.label, where: bucketWheres[i] })),
    { key: "a:other", label: OTHER_LABEL, where: { NOT: { OR: bucketWheres } } },
  ];
  const counts = await Promise.all(
    candidates.map((c) => db.member.count({ where: { AND: [prepared.where, c.where] } })),
  );
  return candidates.map((c, i) => ({ ...c, count: counts[i] })).filter((s) => s.count > 0);
}

/**
 * Org-level sections: members are counted per leaf group in one query, then
 * rolled up to their ancestor at `depth` using the id at that position in the
 * group path. Levels above the viewer are rejected earlier; levels below the
 * leaf level have no ancestor and yield no sections.
 */
async function groupLevelSections(
  prepared: PreparedView,
  groupBy: Extract<GroupBy, { kind: "groupLevel" }>,
): Promise<ComputedSection[]> {
  const rows = await db.member.groupBy({ by: ["groupId"], where: prepared.where, _count: { _all: true } });
  if (rows.length === 0) return [];

  const memberGroups = await db.group.findMany({
    where: { id: { in: rows.map((r) => r.groupId) } },
    select: { id: true, path: true },
  });
  const pathOf = new Map(memberGroups.map((g) => [g.id, g.path]));

  const countByAncestor = new Map<number, number>();
  for (const row of rows) {
    const ancestorId = Number(pathOf.get(row.groupId)?.split("/").filter(Boolean)[groupBy.depth]);
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

/** `null` = the grouping cannot apply for this viewer (org level above their own group). */
async function computeSections(session: SessionUser, prepared: PreparedView): Promise<ComputedSection[] | null> {
  const groupBy = prepared.definition.groupBy;
  if (!groupBy) return null;
  switch (groupBy.kind) {
    case "property":
      return propertySections(prepared, groupBy);
    case "ageBuckets":
      return ageBucketSections(prepared, groupBy);
    case "groupLevel":
      if (groupBy.depth < depthOf(session.groupPath)) return null;
      return groupLevelSections(prepared, groupBy);
  }
}

function findSectionMembers(prepared: PreparedView, section: ComputedSection, offset: number) {
  return db.member.findMany({
    where: { AND: [prepared.where, section.where] },
    orderBy: buildOrderBy(prepared.definition.sort),
    skip: offset,
    take: VIEW_SECTION_PAGE_SIZE,
    select: memberSelectFor(prepared.definition.columns),
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
  const prepared = await prepareView(session, definition, options.today ?? todayInJakarta(DEFAULT_TIMEZONE));
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
  const prepared = await prepareView(session, definition, options.today ?? todayInJakarta(DEFAULT_TIMEZONE));
  const computed = await computeSections(session, prepared);
  const section = computed?.find((s) => s.key === key);
  if (!section) return null;

  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  const members = await findSectionMembers(prepared, section, safeOffset);
  return { members, count: section.count, hasMore: safeOffset + members.length < section.count };
}
