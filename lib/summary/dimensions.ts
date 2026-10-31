import type { Prisma } from "@/lib/generated/prisma/client";
import { ageInYears } from "@/lib/dates";
import { ageRange } from "@/lib/member-view/age";
import { MEMBER_VIEW_FIELDS } from "@/lib/member-view/fields";
import { formatEnumLabel, MEMBER_STATUS_LABELS, SEX_LABELS } from "@/lib/member/labels";
import type { Dimension } from "@/lib/validation/summary";

/**
 * Pure helpers over summary dimensions (member-summaries spec "Summary
 * dimensions"): which buckets a dimension has, which bucket a member falls in
 * (in-memory, for attendance) and the Prisma `where` of each bucket (DB-side
 * counting). Org level and tag keys are counted from grouped queries instead
 * (`lib/summary/count.ts`), so they have no per-bucket `where` here.
 */

export const OTHER_LABEL = "Lainnya";
export const NONE_LABEL = "Tanpa nilai";

export type Bucket = { key: string; label: string };
export type BucketWhere = Bucket & { where: Prisma.MemberWhereInput };

/** A value of a tag key: the tag row's id and its value text. */
export type TagValue = { id: number; value: string };

/** The member columns a bucket depends on. */
export type MemberFacts = {
  sex: string;
  status: string;
  maritalStatus: string;
  workStatus: string;
  birthDate: string;
};

type PropertyDimension = Extract<Dimension, { kind: "property" }>;
/** Dimensions that make sense for one member in memory (no org level). */
export type MemberDimension = Exclude<Dimension, { kind: "groupLevel" }>;

function propertyLabel(field: PropertyDimension["field"], value: string): string {
  if (field === "sex") return SEX_LABELS[value as keyof typeof SEX_LABELS] ?? value;
  if (field === "status") return MEMBER_STATUS_LABELS[value as keyof typeof MEMBER_STATUS_LABELS] ?? value;
  return formatEnumLabel(value);
}

function sortedValues(values: readonly TagValue[]): TagValue[] {
  return [...values].sort((a, b) => a.value.localeCompare(b.value, "id") || a.id - b.id);
}

/** Buckets in display order. `tagValues` are the visible, non-deleted values of a tag key. */
export function dimensionBuckets(dimension: MemberDimension, tagValues: readonly TagValue[] = []): Bucket[] {
  switch (dimension.kind) {
    case "property": {
      const values: readonly string[] = MEMBER_VIEW_FIELDS[dimension.field].values;
      return values.map((value) => ({ key: `p:${value}`, label: propertyLabel(dimension.field, value) }));
    }
    case "ageBuckets":
      return [
        ...dimension.buckets.map((b, i) => ({ key: `a:${i}`, label: b.label })),
        { key: "a:other", label: OTHER_LABEL },
      ];
    case "tag":
      return [
        { key: "tag:yes", label: "Punya" },
        { key: "tag:no", label: "Tidak punya" },
      ];
    case "tagKey":
      return [...sortedValues(tagValues).map((v) => ({ key: `t:${v.id}`, label: v.value })), { key: "t:none", label: NONE_LABEL }];
  }
}

/**
 * Key of the bucket `member` falls in. `tagIds` are the member's tag links;
 * for a tag key only ids in `tagValues` count (hidden or deleted values fold
 * into "Tanpa nilai").
 */
export function bucketOf(
  dimension: MemberDimension,
  member: MemberFacts,
  today: string,
  tagIds: ReadonlySet<number>,
  tagValues: readonly TagValue[] = [],
): string {
  switch (dimension.kind) {
    case "property":
      return `p:${member[dimension.field]}`;
    case "ageBuckets": {
      const age = ageInYears(member.birthDate, today);
      const index = dimension.buckets.findIndex((b) => age >= b.min && (b.max === null || age <= b.max));
      return index === -1 ? "a:other" : `a:${index}`;
    }
    case "tag":
      return tagIds.has(dimension.tagId) ? "tag:yes" : "tag:no";
    case "tagKey": {
      const own = sortedValues(tagValues).find((v) => tagIds.has(v.id));
      return own ? `t:${own.id}` : "t:none";
    }
  }
}

/** Prisma `where` per bucket, in display order. Tag keys are counted with a grouped query instead. */
export function bucketWheres(dimension: Exclude<MemberDimension, { kind: "tagKey" }>, today: string): BucketWhere[] {
  const labels = dimensionBuckets(dimension);
  switch (dimension.kind) {
    case "property":
      return labels.map((b) => ({ ...b, where: { [dimension.field]: b.key.slice(2) } }));
    case "ageBuckets": {
      const wheres: Prisma.MemberWhereInput[] = dimension.buckets.map((b) => ({ birthDate: ageRange(b.min, b.max, today) }));
      return labels.map((b, i) => ({ ...b, where: i < wheres.length ? wheres[i] : { NOT: { OR: wheres } } }));
    }
    case "tag":
      return [
        { ...labels[0], where: { tags: { some: { tagId: dimension.tagId } } } },
        { ...labels[1], where: { tags: { none: { tagId: dimension.tagId } } } },
      ];
  }
}
