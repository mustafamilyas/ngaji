/**
 * Age rules as birth-date bounds. Age is never stored: `age ≥ N` becomes
 * `birthDate ≤ cut(N)` and `age ≤ N` becomes `birthDate > cut(N + 1)`, where
 * `cut(N)` is today's month-day in year `todayYear − N`. Comparing plain
 * `YYYY-MM-DD` strings matches `ageInYears` exactly, including Feb 29
 * (a non-existent `2023-02-29` still sorts between Feb 28 and Mar 1).
 */
export type AgeOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between";

/** Birth-date bounds in Prisma style: `gt` exclusive, `lte` inclusive; a missing key is unbounded. */
export type AgeRange = { gt?: string; lte?: string };

export function birthDateCut(years: number, today: string): string {
  const year = Number(today.slice(0, 4)) - years;
  return `${String(year).padStart(4, "0")}${today.slice(4)}`;
}

/** Birth dates of people aged `min`..`max` whole years inclusive (`null` = unbounded) as of `today`. */
export function ageRange(min: number | null, max: number | null, today: string): AgeRange {
  const range: AgeRange = {};
  if (max !== null) range.gt = birthDateCut(max + 1, today);
  if (min !== null) range.lte = birthDateCut(min, today);
  return range;
}

/**
 * Birth-date ranges (OR-ed) matching an age rule. `value` is a number, or a
 * `[min, max]` pair for `between`. `neq` yields two ranges.
 */
export function ageBirthDateRanges(operator: AgeOperator, value: number | readonly [number, number], today: string): AgeRange[] {
  if (operator === "between") {
    const [min, max] = value as readonly [number, number];
    return [ageRange(min, max, today)];
  }
  const n = value as number;
  switch (operator) {
    case "eq":
      return [ageRange(n, n, today)];
    case "neq":
      return [ageRange(null, n - 1, today), ageRange(n + 1, null, today)];
    case "gt":
      return [ageRange(n + 1, null, today)];
    case "gte":
      return [ageRange(n, null, today)];
    case "lt":
      return [ageRange(null, n - 1, today)];
    case "lte":
      return [ageRange(null, n, today)];
  }
}
