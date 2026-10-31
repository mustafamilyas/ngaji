import { describe, expect, it } from "vitest";
import { MAX_TAG_FILTER_IDS } from "@/lib/constants";
import {
  formatDate,
  formatDateRange,
  parseGroupIds,
  parsePage,
  parseBreakdown,
  parseSearch,
  parseTagId,
  parseTagIds,
  resolveDateRange,
  shiftDateRange,
  type DateRangeConfig,
} from "./filters";

const TODAY = "2026-10-09"; // a Friday

const KEGIATAN: DateRangeConfig = { modes: ["hari", "minggu", "bulan", "custom"], defaultMode: "minggu" };
const STATS: DateRangeConfig = { modes: ["7h", "30h", "90h", "bulan", "custom"], defaultMode: "30h" };
const AUDIT: DateRangeConfig = { modes: ["semua", "7h", "30h", "custom"], defaultMode: "semua" };

describe("parseGroupIds", () => {
  it("parses a comma-separated list of positive integer ids, de-duplicated", () => {
    expect(parseGroupIds("3,5,3")).toEqual([3, 5]);
  });

  it("takes the first value when the param is repeated", () => {
    expect(parseGroupIds(["4,2", "9"])).toEqual([4, 2]);
  });

  it("drops non-integer and non-positive parts", () => {
    expect(parseGroupIds("1,abc,-2,0,2.5,7")).toEqual([1, 7]);
  });

  it("keeps at most 50 ids", () => {
    const raw = Array.from({ length: 80 }, (_, i) => i + 1).join(",");
    expect(parseGroupIds(raw)).toHaveLength(50);
  });

  it("returns undefined when nothing usable is given", () => {
    expect(parseGroupIds(undefined)).toBeUndefined();
    expect(parseGroupIds("")).toBeUndefined();
    expect(parseGroupIds("x,y")).toBeUndefined();
  });
});

describe("parseTagIds", () => {
  it("parses a comma-separated list of positive integer ids, de-duplicated, first param only", () => {
    expect(parseTagIds("3,5,3")).toEqual([3, 5]);
    expect(parseTagIds(["4,2", "9"])).toEqual([4, 2]);
    expect(parseTagIds("1,abc,-2,0,2.5,7")).toEqual([1, 7]);
  });

  it("keeps at most MAX_TAG_FILTER_IDS ids", () => {
    const raw = Array.from({ length: MAX_TAG_FILTER_IDS + 30 }, (_, i) => i + 1).join(",");
    expect(parseTagIds(raw)).toHaveLength(MAX_TAG_FILTER_IDS);
  });

  it("returns undefined when nothing usable is given", () => {
    expect(parseTagIds(undefined)).toBeUndefined();
    expect(parseTagIds("")).toBeUndefined();
    expect(parseTagIds("x,y")).toBeUndefined();
  });
});

describe("parseSearch", () => {
  it("trims and returns the search term", () => {
    expect(parseSearch("  Budi ")).toBe("Budi");
  });

  it("returns undefined for empty or missing input", () => {
    expect(parseSearch("   ")).toBeUndefined();
    expect(parseSearch(undefined)).toBeUndefined();
  });

  it("caps very long input", () => {
    expect(parseSearch("a".repeat(500))).toHaveLength(100);
  });
});

describe("parsePage", () => {
  it("parses a positive integer page", () => {
    expect(parsePage("3")).toBe(3);
  });

  it("falls back to page 1 for invalid input", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("2.7")).toBe(2);
  });
});

describe("resolveDateRange", () => {
  it("uses the default mode anchored at today when nothing is given", () => {
    expect(resolveDateRange({}, KEGIATAN, TODAY)).toEqual({
      mode: "minggu",
      anchor: TODAY,
      from: "2026-10-04",
      to: "2026-10-10",
    });
  });

  it("computes calendar periods around the anchor", () => {
    expect(resolveDateRange({ range: "hari", anchor: "2026-10-01" }, KEGIATAN, TODAY)).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-01",
    });
    expect(resolveDateRange({ range: "bulan", anchor: "2026-02-14" }, KEGIATAN, TODAY)).toMatchObject({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("computes a rolling window of N days ending on the anchor (inclusive)", () => {
    expect(resolveDateRange({ range: "7h" }, STATS, TODAY)).toMatchObject({ from: "2026-10-03", to: TODAY });
    expect(resolveDateRange({ range: "30h" }, STATS, TODAY)).toMatchObject({ from: "2026-09-10", to: TODAY });
  });

  it("returns an open range for `semua`", () => {
    expect(resolveDateRange({}, AUDIT, TODAY)).toEqual({ mode: "semua", anchor: TODAY, from: undefined, to: undefined });
  });

  it("uses explicit from/to for custom, swapping them when reversed", () => {
    expect(
      resolveDateRange({ range: "custom", from: "2026-03-10", to: "2026-03-01" }, KEGIATAN, TODAY),
    ).toMatchObject({ mode: "custom", from: "2026-03-01", to: "2026-03-10" });
  });

  it("treats bare from/to without a range as custom (old links keep working)", () => {
    expect(resolveDateRange({ from: "2024-01-01", to: "2024-01-31" }, STATS, TODAY)).toMatchObject({
      mode: "custom",
      from: "2024-01-01",
      to: "2024-01-31",
    });
  });

  it("fills a missing custom bound from the default range", () => {
    expect(resolveDateRange({ range: "custom", from: "2026-10-01" }, KEGIATAN, TODAY)).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-10",
    });
  });

  it("leaves a missing custom bound open when the default range is open", () => {
    expect(resolveDateRange({ range: "custom", from: "2026-10-01" }, AUDIT, TODAY)).toMatchObject({
      from: "2026-10-01",
      to: undefined,
    });
  });

  it("ignores modes the page does not allow and invalid dates", () => {
    expect(resolveDateRange({ range: "90h" }, KEGIATAN, TODAY).mode).toBe("minggu");
    expect(resolveDateRange({ range: "hari", anchor: "2026-02-31" }, KEGIATAN, TODAY).anchor).toBe(TODAY);
    expect(resolveDateRange({ range: "custom", from: "nope", to: "2026-10-10" }, KEGIATAN, TODAY)).toMatchObject({
      from: "2026-10-04",
      to: "2026-10-10",
    });
  });
});

describe("shiftDateRange", () => {
  it("moves calendar periods by one period", () => {
    expect(shiftDateRange({ mode: "minggu", anchor: TODAY, from: "2026-10-04", to: "2026-10-10" }, 1)).toEqual({
      anchor: "2026-10-16",
    });
    expect(shiftDateRange({ mode: "bulan", anchor: "2026-01-31", from: "2026-01-01", to: "2026-01-31" }, 1)).toEqual({
      anchor: "2026-02-01",
    });
    expect(shiftDateRange({ mode: "hari", anchor: TODAY, from: TODAY, to: TODAY }, -1)).toEqual({
      anchor: "2026-10-08",
    });
  });

  it("moves rolling windows by their length", () => {
    expect(shiftDateRange({ mode: "7h", anchor: TODAY, from: "2026-10-03", to: TODAY }, -1)).toEqual({
      anchor: "2026-10-02",
    });
  });

  it("moves a custom range by its own length", () => {
    expect(
      shiftDateRange({ mode: "custom", anchor: TODAY, from: "2026-10-01", to: "2026-10-10" }, 1),
    ).toEqual({ from: "2026-10-11", to: "2026-10-20" });
  });

  it("cannot shift an open range", () => {
    expect(shiftDateRange({ mode: "semua", anchor: TODAY, from: undefined, to: undefined }, 1)).toBeNull();
    expect(shiftDateRange({ mode: "custom", anchor: TODAY, from: "2026-10-01", to: undefined }, 1)).toBeNull();
  });
});

describe("formatDate", () => {
  it("formats a single date", () => {
    expect(formatDate("1990-03-12")).toBe("12 Mar 1990");
  });
});

describe("formatDateRange", () => {
  it("collapses shared month and year", () => {
    expect(formatDateRange("2026-10-04", "2026-10-10")).toBe("4–10 Okt 2026");
    expect(formatDateRange("2026-10-09", "2026-10-09")).toBe("9 Okt 2026");
  });

  it("spells out both sides across months and years", () => {
    expect(formatDateRange("2026-09-10", "2026-10-09")).toBe("10 Sep – 9 Okt 2026");
    expect(formatDateRange("2025-12-28", "2026-01-03")).toBe("28 Des 2025 – 3 Jan 2026");
  });

  it("describes half-open and open ranges", () => {
    expect(formatDateRange("2026-10-01", undefined)).toBe("sejak 1 Okt 2026");
    expect(formatDateRange(undefined, "2026-10-01")).toBe("s.d. 1 Okt 2026");
    expect(formatDateRange(undefined, undefined)).toBe("Semua waktu");
  });
});

describe("parseTagId", () => {
  it("parses one positive integer id", () => {
    expect(parseTagId("12")).toBe(12);
    expect(parseTagId(["4", "9"])).toBe(4);
  });

  it("ignores anything that is not exactly one positive integer", () => {
    for (const raw of [undefined, "", "0", "-3", "1.5", "abc", "3,5", " 7", "7x", "1e2"]) {
      expect(parseTagId(raw), String(raw)).toBeUndefined();
    }
  });
});

describe("parseBreakdown", () => {
  it("accepts the fixed dimensions", () => {
    expect(parseBreakdown("sex")).toEqual({ kind: "sex" });
    expect(parseBreakdown("age")).toEqual({ kind: "age" });
    expect(parseBreakdown("marital")).toEqual({ kind: "marital" });
    expect(parseBreakdown("work")).toEqual({ kind: "work" });
  });

  it("accepts tag:<id> for a tag key or simple tag", () => {
    expect(parseBreakdown("tag:7")).toEqual({ kind: "tag", tagId: 7 });
    expect(parseBreakdown(["tag:3", "sex"])).toEqual({ kind: "tag", tagId: 3 });
  });

  it("ignores values outside the allow-list", () => {
    for (const raw of [undefined, "", "status", "SEX", "phone", "tag", "tag:", "tag:0", "tag:-1", "tag:1.5", "tag:abc", "tag:1,2", "tag:7:8", "constructor", "__proto__"]) {
      expect(parseBreakdown(raw), String(raw)).toBeUndefined();
    }
  });
});
