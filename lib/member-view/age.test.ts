import { describe, expect, it } from "vitest";
import { addDays, ageInYears } from "@/lib/dates";
import { ageBirthDateRanges, ageRange, birthDateCut, type AgeRange } from "./age";

function inRanges(birthDate: string, ranges: AgeRange[]): boolean {
  return ranges.some((r) => (r.gt === undefined || birthDate > r.gt) && (r.lte === undefined || birthDate <= r.lte));
}

describe("birthDateCut", () => {
  it("keeps today's month and day, shifting the year", () => {
    expect(birthDateCut(17, "2026-10-12")).toBe("2009-10-12");
    expect(birthDateCut(0, "2026-10-12")).toBe("2026-10-12");
  });

  it("pads years below 1000", () => {
    expect(birthDateCut(1500, "2026-10-12")).toBe("0526-10-12");
  });
});

describe("Age is computed", () => {
  it("counts a birthday today", () => {
    expect(inRanges("2009-10-12", ageBirthDateRanges("gte", 17, "2026-10-12"))).toBe(true);
  });

  it("excludes the day before the birthday", () => {
    expect(inRanges("2009-10-12", ageBirthDateRanges("gte", 17, "2026-10-11"))).toBe(false);
  });

  it("between is inclusive on both ends", () => {
    const today = "2026-10-12";
    const ranges = [ageRange(13, 17, today)];
    expect(inRanges("2013-10-12", ranges)).toBe(true); // exactly 13
    expect(inRanges("2009-10-13", ranges)).toBe(true); // 17 until the day before 18
    expect(inRanges("2008-10-12", ranges)).toBe(false); // 18
    expect(inRanges("2013-10-13", ranges)).toBe(false); // 12
  });

  it("supports open-ended ranges", () => {
    expect(ageRange(60, null, "2026-10-12")).toEqual({ lte: "1966-10-12" });
    expect(ageRange(null, 12, "2026-10-12")).toEqual({ gt: "2013-10-12" });
    expect(ageRange(null, null, "2026-10-12")).toEqual({});
  });
});

describe("age ranges agree with ageInYears", () => {
  const operators = ["eq", "neq", "gt", "gte", "lt", "lte"] as const;
  const todays = ["2024-02-28", "2024-02-29", "2024-03-01", "2025-02-28", "2025-03-01", "2026-10-12", "2027-01-01", "2028-02-29"];

  it.each(todays)("matches for every birth day over 4 years, today = %s", (today) => {
    // 1450 days of birth dates around today, covering Feb 29 birthdays and leap boundaries.
    for (let offset = 0; offset <= 365 * 4 + 1; offset++) {
      const birth = addDays(today, -offset);
      const age = ageInYears(birth, today);
      for (const op of operators) {
        for (const value of [0, 1, 2, 3, 4]) {
          const expected = { eq: age === value, neq: age !== value, gt: age > value, gte: age >= value, lt: age < value, lte: age <= value }[op];
          expect(inRanges(birth, ageBirthDateRanges(op, value, today)), `${birth} ${op} ${value} on ${today}`).toBe(expected);
        }
      }
      for (const [min, max] of [[0, 0], [1, 3], [2, 2], [0, 4]]) {
        expect(inRanges(birth, ageBirthDateRanges("between", [min, max], today)), `${birth} between ${min},${max} on ${today}`).toBe(
          age >= min && age <= max,
        );
      }
    }
  });

  it("handles a Feb 29 birthday in non-leap years", () => {
    // Born 2000-02-29: turns 23 on 2023-03-01 under ageInYears (Feb 28 < 29 → still 22).
    expect(ageInYears("2000-02-29", "2023-02-28")).toBe(22);
    expect(ageInYears("2000-02-29", "2023-03-01")).toBe(23);
    expect(inRanges("2000-02-29", ageBirthDateRanges("gte", 23, "2023-02-28"))).toBe(false);
    expect(inRanges("2000-02-29", ageBirthDateRanges("gte", 23, "2023-03-01"))).toBe(true);
    expect(inRanges("2000-02-29", ageBirthDateRanges("eq", 24, "2024-02-29"))).toBe(true);
  });
});
