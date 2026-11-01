import { AGE_BRACKETS } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth/session-user";
import type { BreakdownChoice } from "@/lib/filters";
import { bucketOf, dimensionBuckets, type MemberDimension, type MemberFacts, type TagValue } from "./dimensions";
import { resolveVisibleTag } from "./tags";

/**
 * A resolved "Rincian menurut" choice for attendance statistics: a member
 * dimension plus, for a tag key, its visible values (member-summaries design D4).
 */
export type Breakdown = { label: string; dimension: MemberDimension; tagValues: TagValue[] };

/** One row of the breakdown table; rows of a tally add up to the page's totals. */
export type BreakdownRow = {
  key: string;
  label: string;
  expected: number;
  hadir: number;
  izin: number;
  absent: number;
  percentHadir: number;
};

export type AttendanceBreakdown = { label: string; rows: BreakdownRow[] };

const FIXED: Record<"sex" | "marital" | "work", { label: string; field: "sex" | "maritalStatus" | "workStatus" }> = {
  sex: { label: "Jenis kelamin", field: "sex" },
  marital: { label: "Status pernikahan", field: "maritalStatus" },
  work: { label: "Status pekerjaan", field: "workStatus" },
};

/**
 * Turns the parsed `?rincian=` into a usable breakdown. A tag the viewer cannot
 * see (unknown, deleted, other organization, other branch) yields `null`, the
 * same as no choice: the page shows no breakdown and no error.
 */
export async function resolveBreakdown(session: SessionUser, choice: BreakdownChoice | undefined): Promise<Breakdown | null> {
  if (!choice) return null;
  if (choice.kind === "age") {
    const buckets = AGE_BRACKETS.map(({ label, min, max }) => ({ label, min, max }));
    return { label: "Kelompok umur", dimension: { kind: "ageBuckets", buckets }, tagValues: [] };
  }
  if (choice.kind !== "tag") {
    const { label, field } = FIXED[choice.kind];
    return { label, dimension: { kind: "property", field }, tagValues: [] };
  }
  const tag = await resolveVisibleTag(session, choice.tagId);
  if (!tag) return null;
  if (tag.kind === "tag") return { label: tag.label, dimension: { kind: "tag", tagId: tag.tagId }, tagValues: [] };
  return { label: tag.label, dimension: { kind: "tagKey", tagId: tag.tagId }, tagValues: tag.values };
}

const percentOf = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

/**
 * Accumulates expected / hadir / izin per bucket while the caller walks the
 * occurrences it already counts. Members are placed by their current values
 * (age on `asOf`, tags currently linked). Buckets nobody was expected in are
 * left out of `rows()`.
 */
export function createTally(breakdown: Breakdown, asOf: string) {
  const buckets = dimensionBuckets(breakdown.dimension, breakdown.tagValues);
  const counts = new Map(buckets.map((b) => [b.key, { expected: 0, hadir: 0, izin: 0 }]));

  return {
    /** `status` is the member's attendance on this occurrence (absent = no row). */
    add(member: MemberFacts, tagIds: ReadonlySet<number>, status: string | undefined) {
      const count = counts.get(bucketOf(breakdown.dimension, member, asOf, tagIds, breakdown.tagValues))!;
      count.expected++;
      if (status === "HADIR") count.hadir++;
      else if (status === "IZIN") count.izin++;
    },
    rows(): BreakdownRow[] {
      return buckets
        .map((b) => ({ ...b, ...counts.get(b.key)! }))
        .filter((r) => r.expected > 0)
        .map((r) => ({ ...r, absent: r.expected - r.hadir - r.izin, percentHadir: percentOf(r.hadir, r.expected) }));
    },
  };
}
