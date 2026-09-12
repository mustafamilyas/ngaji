import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  addMonthsOnDay,
  ageInYears,
  daysBetween,
  fromDbDate,
  monthsBetween,
  sundayOf,
  toDbDate,
  today,
  weekdayOf,
  weeksBetween,
} from "./dates";

describe("ageInYears", () => {
  it("counts a birthday that already happened this year", () => {
    expect(ageInYears("1966-09-10", "2026-09-11")).toBe(60);
  });

  it("counts someone turning an age exactly today as already that age", () => {
    expect(ageInYears("1966-09-11", "2026-09-11")).toBe(60);
  });

  it("does not count a birthday that has not happened yet this year", () => {
    expect(ageInYears("1966-09-12", "2026-09-11")).toBe(59);
  });
});

describe("today", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the Asia/Jakarta calendar date, not the host's UTC date", () => {
    // 2024-01-01T17:30:00Z = 2024-01-02T00:30 in Asia/Jakarta (UTC+7)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T17:30:00Z"));
    expect(today()).toBe("2024-01-02");
  });

  it("uses the Asia/Jakarta calendar date regardless of host TZ (independent of process.env.TZ)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T10:00:00Z")); // 17:00 in Jakarta, same day
    expect(today()).toBe("2024-06-15");
  });
});

describe("toDbDate / fromDbDate", () => {
  it("round-trip a valid YYYY-MM-DD string unchanged", () => {
    expect(toDbDate("2024-03-05")).toBe("2024-03-05");
    expect(fromDbDate("2024-03-05")).toBe("2024-03-05");
  });

  it("rejects malformed date strings", () => {
    expect(() => toDbDate("2024-3-5")).toThrow();
    expect(() => toDbDate("03-05-2024")).toThrow();
    expect(() => fromDbDate("not-a-date")).toThrow();
  });
});

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2024-01-01", 1)).toBe("2024-01-02");
  });

  it("carries over a month boundary", () => {
    expect(addDays("2024-01-31", 1)).toBe("2024-02-01");
  });

  it("carries over a leap-year February boundary", () => {
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
  });

  it("supports negative offsets", () => {
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });
});

describe("sundayOf", () => {
  it("returns the same date when already a Sunday", () => {
    expect(sundayOf("2023-12-31")).toBe("2023-12-31"); // Sunday
  });

  it("returns the preceding Sunday for a mid-week date", () => {
    expect(sundayOf("2024-01-03")).toBe("2023-12-31"); // Wednesday -> prior Sunday
  });

  it("returns the preceding Sunday for a Saturday", () => {
    expect(sundayOf("2024-01-06")).toBe("2023-12-31"); // Saturday -> prior Sunday
  });
});

describe("daysBetween", () => {
  it("counts whole days between two dates", () => {
    expect(daysBetween("2024-01-01", "2024-01-10")).toBe(9);
  });

  it("is zero for the same date", () => {
    expect(daysBetween("2024-01-01", "2024-01-01")).toBe(0);
  });

  it("is negative when `to` is before `from`", () => {
    expect(daysBetween("2024-01-10", "2024-01-01")).toBe(-9);
  });
});

describe("weeksBetween", () => {
  it("counts whole weeks between two Sunday anchors", () => {
    expect(weeksBetween("2023-12-31", "2024-01-07")).toBe(1);
    expect(weeksBetween("2023-12-31", "2024-01-14")).toBe(2);
  });

  it("is zero for the same date", () => {
    expect(weeksBetween("2023-12-31", "2023-12-31")).toBe(0);
  });
});

describe("monthsBetween", () => {
  it("counts calendar months regardless of day-of-month", () => {
    expect(monthsBetween("2024-01-31", "2024-03-01")).toBe(2);
  });

  it("is zero within the same calendar month", () => {
    expect(monthsBetween("2024-01-05", "2024-01-31")).toBe(0);
  });

  it("crosses a year boundary", () => {
    expect(monthsBetween("2023-11-15", "2024-02-01")).toBe(3);
  });
});

describe("weekdayOf", () => {
  it("returns 0 for a Sunday", () => {
    expect(weekdayOf("2026-09-06")).toBe(0);
  });

  it("returns 3 for a Wednesday", () => {
    expect(weekdayOf("2026-09-09")).toBe(3);
  });

  it("returns 6 for a Saturday", () => {
    expect(weekdayOf("2026-09-12")).toBe(6);
  });
});

describe("addMonthsOnDay", () => {
  it("returns the same date for zero months", () => {
    expect(addMonthsOnDay("2026-01-31", 0, 31)).toBe("2026-01-31");
  });

  it("returns null when the target month is shorter than the day", () => {
    // 2026 is not a leap year; February has 28 days
    expect(addMonthsOnDay("2026-01-31", 1, 31)).toBeNull();
  });

  it("returns the date when the target month has enough days", () => {
    expect(addMonthsOnDay("2026-01-31", 2, 31)).toBe("2026-03-31");
  });

  it("carries over a year boundary", () => {
    expect(addMonthsOnDay("2026-11-15", 3, 15)).toBe("2027-02-15");
  });
});
