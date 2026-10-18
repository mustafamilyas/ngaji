import type { AgeBracket } from "@/lib/constants";
import { addDays } from "@/lib/dates";

export type ChoiceSummaryRow = {
  optionId: number;
  label: string;
  archived: boolean;
  count: number;
  /** Relative to the question's answered count, 1 decimal; multi-choice may sum above 100. */
  percent: number;
};

/** Every option (archived and zero-count included) in the given order, with count and share of `answeredCount`. */
export function summarizeChoice(
  options: readonly { id: number; label: string; archived: boolean }[],
  countsByOption: ReadonlyMap<number, number>,
  answeredCount: number,
): ChoiceSummaryRow[] {
  return options.map((option) => {
    const count = countsByOption.get(option.id) ?? 0;
    const percent = answeredCount > 0 ? Math.round((count / answeredCount) * 1000) / 10 : 0;
    return { optionId: option.id, label: option.label, archived: option.archived, count, percent };
  });
}

export type ScaleSummary = {
  count: number;
  average: number | null;
  distribution: { value: number; count: number }[];
};

/** Count per scale value from `min` to `max` (zero buckets included) and the mean of the counted answers. */
export function summarizeScale(min: number, max: number, countsByValue: ReadonlyMap<number, number>): ScaleSummary {
  const distribution: ScaleSummary["distribution"] = [];
  let count = 0;
  let sum = 0;
  for (let value = min; value <= max; value++) {
    const c = countsByValue.get(value) ?? 0;
    distribution.push({ value, count: c });
    count += c;
    sum += value * c;
  }
  return { count, average: count > 0 ? sum / count : null, distribution };
}

function yearsBefore(date: string, years: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = year - years;
  const leap = (target % 4 === 0 && target % 100 !== 0) || target % 400 === 0;
  // A Feb 29 anchor has no equivalent in a non-leap year; Feb 28 matches `ageInYears` (the birthday is on Mar 1).
  const clampedDay = month === 2 && day === 29 && !leap ? 28 : day;
  return `${String(target).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

/**
 * Inclusive `birthDate` range (`YYYY-MM-DD`) of members whose age on `asOf`
 * lies in the bracket, consistent with `ageInYears`. `from` is omitted for an
 * open-ended bracket; a bracket with `min = 0` has `to = asOf`.
 */
export function ageBracketRange(bracket: AgeBracket, asOf: string): { from?: string; to: string } {
  const to = yearsBefore(asOf, bracket.min);
  if (bracket.max === null) return { to };
  return { from: addDays(yearsBefore(asOf, bracket.max + 1), 1), to };
}
