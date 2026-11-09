import { describe, expect, it } from "vitest";
import { evaluate, formatReport, SCENARIOS, type Result } from "./scenarios";

const result = (over: Partial<Result> = {}): Result => ({
  name: "week",
  description: "d",
  rows: 6,
  pages: 1,
  maxPages: 1,
  file: "/tmp/week.pdf",
  ...over,
});

describe("SCENARIOS", () => {
  it("covers a typical week, the same week filtered by a tag, two months and max-length text", () => {
    expect(SCENARIOS.map((s) => s.name)).toEqual(["week", "week-tag", "two-months", "long-text"]);
  });

  it("holds a page budget for all but the max-length text, which is only reported", () => {
    const budgets = Object.fromEntries(SCENARIOS.map((s) => [s.name, s.maxPages]));
    expect(budgets).toEqual({ week: 1, "week-tag": 1, "two-months": 3, "long-text": null });
  });

  it("filters the tag scenario by a seeded tag over the same range as the plain week", () => {
    const [week, weekTag] = SCENARIOS;
    expect(weekTag.tag).toEqual({ key: "prioritas", value: "tinggi" });
    expect(weekTag.range("2026-10-27")).toEqual(week.range("2026-10-27"));
  });

  it("builds a range of the right length from the organization's today", () => {
    const [week, , months] = SCENARIOS.map((s) => s.range("2026-10-27"));
    expect(week).toEqual({ from: "2026-10-27", to: "2026-11-02" });
    expect(months).toEqual({ from: "2026-09-01", to: "2026-10-31" });
  });
});

describe("evaluate", () => {
  it("is fine when the pages are within the budget", () => {
    expect(evaluate(result({ pages: 1, maxPages: 1 }))).toBeNull();
  });

  it("is a defect when the budget is exceeded", () => {
    expect(evaluate(result({ pages: 2, maxPages: 1 }))).toMatch(/2 pages.*at most 1/);
  });

  it("is a defect when nothing was printed", () => {
    expect(evaluate(result({ pages: 0, maxPages: null }))).toMatch(/no pages/i);
  });

  it("is a defect when the range had no occurrences, because nothing was measured", () => {
    expect(evaluate(result({ rows: 0, pages: 1 }))).toMatch(/no occurrences/i);
  });

  it("is a defect when a tag filter did not narrow the schedule", () => {
    expect(evaluate(result({ name: "week-tag", rows: 6, unfilteredRows: 6 }))).toMatch(/tag filter.*6 of 6/i);
    expect(evaluate(result({ name: "week-tag", rows: 2, unfilteredRows: 6 }))).toBeNull();
  });

  it("never fails a report-only scenario that printed something", () => {
    expect(evaluate(result({ pages: 9, maxPages: null }))).toBeNull();
  });
});

describe("formatReport", () => {
  it("lists every scenario with rows, pages, budget and verdict", () => {
    const text = formatReport([result(), result({ name: "long-text", pages: 4, maxPages: null, rows: 10 })]);
    expect(text).toMatch(/week\s+6 rows\s+1 page\s+budget 1\s+ok/);
    expect(text).toMatch(/long-text\s+10 rows\s+4 pages\s+report only\s+ok/);
  });

  it("flags a failing scenario and names the defect", () => {
    const text = formatReport([result({ pages: 3, maxPages: 1 })]);
    expect(text).toContain("FAIL");
    expect(text).toMatch(/3 pages.*at most 1/);
  });
});
