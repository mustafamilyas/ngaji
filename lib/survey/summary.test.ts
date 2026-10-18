import { describe, expect, it } from "vitest";
import { AGE_BRACKETS } from "@/lib/constants";
import { addDays, ageInYears } from "@/lib/dates";
import { ageBracketRange, summarizeChoice, summarizeScale } from "./summary";

describe("summarizeChoice", () => {
  const options = [
    { id: 1, label: "A", archived: false },
    { id: 2, label: "B", archived: false },
    { id: 3, label: "C", archived: true },
  ];

  it("computes percentages relative to the answered count, so multi-choice can exceed 100%", () => {
    const rows = summarizeChoice(options, new Map([[1, 3], [2, 2]]), 4);
    expect(rows[0]).toEqual({ optionId: 1, label: "A", archived: false, count: 3, percent: 75 });
    expect(rows[1]).toMatchObject({ optionId: 2, count: 2, percent: 50 });
    expect(rows.reduce((sum, r) => sum + r.percent, 0)).toBe(125);
  });

  it("keeps options with zero count and archived options, in the given order", () => {
    const rows = summarizeChoice(options, new Map([[1, 1]]), 1);
    expect(rows.map((r) => [r.optionId, r.count, r.archived])).toEqual([
      [1, 1, false],
      [2, 0, false],
      [3, 0, true],
    ]);
  });

  it("returns 0% everywhere when nobody answered", () => {
    expect(summarizeChoice(options, new Map(), 0).every((r) => r.percent === 0)).toBe(true);
  });

  it("rounds to one decimal", () => {
    expect(summarizeChoice(options, new Map([[1, 1]]), 3)[0].percent).toBe(33.3);
  });
});

describe("summarizeScale", () => {
  it("includes every value from min to max, with zero counts", () => {
    const summary = summarizeScale(1, 5, new Map([[1, 2], [3, 1], [5, 1]]));
    expect(summary.distribution).toEqual([
      { value: 1, count: 2 },
      { value: 2, count: 0 },
      { value: 3, count: 1 },
      { value: 4, count: 0 },
      { value: 5, count: 1 },
    ]);
    expect(summary.count).toBe(4);
    expect(summary.average).toBe(2.5);
  });

  it("has a null average when there are no answers", () => {
    expect(summarizeScale(1, 3, new Map())).toMatchObject({ count: 0, average: null });
  });

  it("ignores counts outside the current range (e.g. stale data)", () => {
    expect(summarizeScale(1, 3, new Map([[9, 4]])).count).toBe(0);
  });

  it("supports ranges starting at zero", () => {
    expect(summarizeScale(0, 2, new Map([[0, 1]])).distribution.map((d) => d.value)).toEqual([0, 1, 2]);
  });
});

describe("ageBracketRange", () => {
  const asOf = "2026-10-10";

  it("returns an inclusive birthDate range for a bounded bracket", () => {
    // "anak" 6–12: youngest is exactly 6 today, oldest turns 13 tomorrow.
    expect(ageBracketRange({ label: "anak", min: 6, max: 12 }, asOf)).toEqual({ from: "2013-10-11", to: "2020-10-10" });
  });

  it("is open-ended for the last bracket", () => {
    expect(ageBracketRange({ label: "lansia", min: 60, max: null }, asOf)).toEqual({ to: "1966-10-10" });
  });

  it("matches ageInYears for every configured bracket around the boundaries", () => {
    for (const asOfDate of ["2026-10-10", "2028-02-29", "2027-03-01", "2027-02-28"]) {
      for (const bracket of AGE_BRACKETS) {
        const { from, to } = ageBracketRange(bracket, asOfDate);
        for (const edge of [from, to]) {
          if (!edge) continue;
          for (let delta = -2; delta <= 2; delta++) {
            const birth = addDays(edge, delta);
            const inRange = (!from || birth >= from) && (!to || birth <= to);
            const age = ageInYears(birth, asOfDate);
            const inBracket = age >= bracket.min && (bracket.max === null || age <= bracket.max);
            expect(inRange, `${bracket.label} birth ${birth} as of ${asOfDate}`).toBe(inBracket);
          }
        }
      }
    }
  });
});
