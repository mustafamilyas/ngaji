import { compareValues, type SortState } from "@/lib/sort";

type SortableSurvey = {
  id: number;
  title: string;
  group: { name: string };
  responseCount: number;
  createdAt: Date;
};

export const SURVEY_SORT_KEYS = ["judul", "grup", "respons", "dibuat"] as const;
export type SurveySortKey = (typeof SURVEY_SORT_KEYS)[number];
export const DEFAULT_SURVEY_SORT: SortState<SurveySortKey> = { key: "dibuat", dir: "desc" };

const VALUE: Record<SurveySortKey, (s: SortableSurvey) => string | number> = {
  judul: (s) => s.title,
  grup: (s) => s.group.name,
  respons: (s) => s.responseCount,
  dibuat: (s) => s.createdAt.getTime(),
};

/** `/dashboard/survei` list order (sorted in memory: the response count is scope-dependent); ties fall back to newest first. */
export function sortSurveys<T extends SortableSurvey>(surveys: T[], sort: SortState<SurveySortKey>): T[] {
  return [...surveys].sort(
    (a, b) =>
      compareValues(VALUE[sort.key](a), VALUE[sort.key](b), sort.dir) ||
      compareValues(VALUE.dibuat(a), VALUE.dibuat(b), "desc") ||
      b.id - a.id,
  );
}
