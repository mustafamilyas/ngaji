import { describe, expect, it } from "vitest";
import { expandDates, type ActivityRule } from "./expand";

function rule(overrides: Partial<ActivityRule> = {}): ActivityRule {
  return {
    freq: "ONCE",
    interval: 1,
    weekdays: [],
    monthDay: null,
    startsOn: "2026-01-01",
    endsOn: null,
    ...overrides,
  };
}

describe("expandDates", () => {
  describe("ONCE", () => {
    it("returns the single date when it falls inside the range", () => {
      const result = expandDates(
        rule({ freq: "ONCE", startsOn: "2026-02-01" }),
        "2026-01-01",
        "2026-03-01",
      );
      expect(result).toEqual(["2026-02-01"]);
    });

    it("returns nothing when the date falls outside the range", () => {
      const result = expandDates(
        rule({ freq: "ONCE", startsOn: "2026-02-01" }),
        "2026-03-01",
        "2026-03-31",
      );
      expect(result).toEqual([]);
    });
  });

  describe("DAILY", () => {
    it("steps by the interval in days", () => {
      const result = expandDates(
        rule({ freq: "DAILY", interval: 3, startsOn: "2026-01-01" }),
        "2026-01-01",
        "2026-01-10",
      );
      expect(result).toEqual(["2026-01-01", "2026-01-04", "2026-01-07", "2026-01-10"]);
    });
  });

  describe("WEEKLY", () => {
    it("anchors weeks on Sunday and respects interval starting mid-week", () => {
      const result = expandDates(
        rule({
          freq: "WEEKLY",
          startsOn: "2026-09-09", // Wednesday
          weekdays: [0, 3],
          interval: 2,
        }),
        "2026-09-06",
        "2026-09-30",
      );
      expect(result).toEqual(["2026-09-09", "2026-09-20", "2026-09-23"]);
    });
  });

  describe("MONTHLY", () => {
    it("skips months that lack the given day", () => {
      const result = expandDates(
        rule({ freq: "MONTHLY", startsOn: "2026-01-31", monthDay: 31 }),
        "2026-01-01",
        "2026-05-31",
      );
      expect(result).toEqual(["2026-01-31", "2026-03-31", "2026-05-31"]);
    });
  });

  it("bounds results by endsOn when set", () => {
    const result = expandDates(
      rule({ freq: "DAILY", startsOn: "2026-01-01", endsOn: "2026-01-05" }),
      "2026-01-01",
      "2026-01-31",
    );
    expect(result).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
    ]);
  });

  it("throws when the range exceeds 366 days", () => {
    expect(() =>
      expandDates(rule({ freq: "DAILY" }), "2026-01-01", "2027-01-03"),
    ).toThrow();
  });

  it("does not throw at exactly 366 days", () => {
    expect(() =>
      expandDates(rule({ freq: "DAILY", interval: 400 }), "2026-01-01", "2027-01-02"),
    ).not.toThrow();
  });
});
