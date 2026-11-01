import type { SessionUser } from "@/lib/auth/session-user";
import { EMBEDDED_PAGE_SIZE, SUMMARY_MAX_BARS } from "@/lib/constants";
import { today as todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { getLevels } from "@/lib/group/levels";
import { paginate, type Paginated } from "@/lib/pagination";
import {
  countByAgeBuckets,
  countByGroupLevel,
  countByProperty,
  countByTag,
  countByTagKey,
  depthOf,
  type CountedBucket,
} from "@/lib/summary/count";
import { resolveVisibleTag } from "@/lib/summary/tags";
import type { Dimension } from "@/lib/validation/summary";
import type { Definition } from "@/lib/validation/member-view";
import { MEMBER_VIEW_FIELDS } from "./fields";
import { prepareView, type PreparedView } from "./results";

/** One bucket as the card shows it: its count and its share of the population (%, one decimal). */
export type SummaryBucket = { key: string; label: string; count: number; percent: number };

/** What the page renders for one "Ringkasan" card. */
export type SummaryCard = {
  /** Position in the definition's `summaries` after unusable ones were dropped; names the card's page param. */
  index: number;
  dimension: Dimension;
  /** Dimension label: field name, "Usia", level name or tag key. */
  title: string;
  /** Size of the view's population. */
  total: number;
  /** Org level above the viewer's own group: nothing is counted. */
  levelInvalid?: boolean;
  /** Number of non-empty buckets. */
  bucketCount: number;
  /** The first `SUMMARY_MAX_BARS` non-empty buckets, in display order. */
  chart: SummaryBucket[];
  /** One page of all buckets, only when there are more than `SUMMARY_MAX_BARS`. */
  table: Paginated<SummaryBucket> | null;
};

export type ViewSummariesResult = { dropped: boolean; total: number; cards: SummaryCard[] };

function share(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

async function countsFor(
  session: SessionUser,
  prepared: PreparedView,
  dimension: Dimension,
): Promise<{ title: string; buckets: CountedBucket[]; levelInvalid?: true } | null> {
  const { where, today } = prepared;
  switch (dimension.kind) {
    case "property":
      return { title: MEMBER_VIEW_FIELDS[dimension.field].label, buckets: await countByProperty(where, dimension, today) };
    case "ageBuckets":
      return { title: MEMBER_VIEW_FIELDS.age.label, buckets: await countByAgeBuckets(where, dimension, today) };
    case "groupLevel": {
      const levels = await getLevels(session.organizationId);
      const title = levels.find((l) => l.depth === dimension.depth)?.name ?? `Tingkat ${dimension.depth}`;
      if (dimension.depth < depthOf(session.groupPath)) return { title, buckets: [], levelInvalid: true };
      return { title, buckets: await countByGroupLevel(where, dimension) };
    }
    case "tag":
    case "tagKey": {
      // Already known to be usable (lenient pass in `prepareView`); null only if it vanished since.
      const tag = await resolveVisibleTag(session, dimension.tagId);
      if (!tag) return null;
      if (dimension.kind === "tag" && tag.kind === "tag") {
        return { title: tag.label, buckets: await countByTag(where, dimension, today) };
      }
      if (dimension.kind === "tagKey" && tag.kind === "tagKey") {
        return { title: tag.label, buckets: await countByTagKey(where, tag.values) };
      }
      return null;
    }
  }
}

/**
 * Every summary of a view definition, counted by the database over the view's
 * result set (filter + scope + not deleted). Sorting, grouping, columns and the
 * member list's page play no part. `options.pages` maps a card index to the page
 * of its bucket table (`?ringkasan<i>=`); out-of-range pages are clamped.
 */
export async function computeSummaries(
  session: SessionUser,
  definition: Definition,
  options: { today?: string; pages?: Record<number, number> } = {},
): Promise<ViewSummariesResult> {
  const prepared = await prepareView(session, definition, options.today ?? todayIn(session.timeZone));
  const summaries = prepared.definition.summaries ?? [];
  if (summaries.length === 0) return { dropped: prepared.dropped, total: 0, cards: [] };

  const total = await db.member.count({ where: prepared.where });
  const cards = await Promise.all(
    summaries.map(async ({ dimension }, index): Promise<SummaryCard | null> => {
      const counted = await countsFor(session, prepared, dimension);
      if (counted === null) return null;
      if (counted.levelInvalid) {
        return { index, dimension, title: counted.title, total, levelInvalid: true, bucketCount: 0, chart: [], table: null };
      }
      const buckets = counted.buckets
        .filter((b) => b.count > 0)
        .map(({ key, label, count }) => ({ key, label, count, percent: share(count, total) }));
      const table =
        buckets.length > SUMMARY_MAX_BARS ? paginate(buckets, options.pages?.[index] ?? 1, EMBEDDED_PAGE_SIZE) : null;
      return { index, dimension, title: counted.title, total, bucketCount: buckets.length, chart: buckets.slice(0, SUMMARY_MAX_BARS), table };
    }),
  );
  const kept = cards.filter((c): c is SummaryCard => c !== null);
  return { dropped: prepared.dropped || kept.length !== cards.length, total, cards: kept };
}
