import { PAGE_SIZE } from "@/lib/constants";
import { paginate, type Paginated } from "@/lib/pagination";
import { type ParticipationSortKey, type SortState, sortParticipation } from "@/lib/sort";
import type { ParticipationRow } from "@/lib/stats";

/**
 * One page of the participation table, done on the server: name search first, then the global order, then the
 * slice, so page 2 continues page 1 and only `pageSize` rows ever reach the browser.
 */
export function participationPage(
  rows: ParticipationRow[],
  { sort, page, q, pageSize = PAGE_SIZE }: { sort: SortState<ParticipationSortKey>; page: number; q?: string; pageSize?: number },
): Paginated<ParticipationRow> {
  const needle = q?.toLocaleLowerCase("id-ID");
  const matching = needle ? rows.filter((r) => r.memberName.toLocaleLowerCase("id-ID").includes(needle)) : rows;
  return paginate(sortParticipation(matching, sort), page, pageSize);
}
