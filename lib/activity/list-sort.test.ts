import { describe, expect, it } from "vitest";
import { sortActivityEntries } from "./list-sort";

const entry = (activityName: string, effectiveDate: string, effectiveStartTime = "19:00", groupName = "Desa A") => ({
  activityName,
  groupName,
  effectiveDate,
  effectiveStartTime,
  effectiveLocation: "Masjid",
});

describe("sortActivityEntries", () => {
  const entries = [
    entry("Kajian", "2026-10-12"),
    entry("Arisan", "2026-10-10", "20:00"),
    entry("Arisan", "2026-10-10", "08:00"),
  ];

  it("orders by date and time by default", () => {
    expect(sortActivityEntries(entries, { key: "tanggal", dir: "asc" }).map((e) => e.effectiveStartTime)).toEqual([
      "08:00",
      "20:00",
      "19:00",
    ]);
    expect(sortActivityEntries(entries, { key: "tanggal", dir: "desc" })[0].activityName).toBe("Kajian");
  });

  it("orders by name with date and time as tie-breaker, without mutating the input", () => {
    const sorted = sortActivityEntries(entries, { key: "kegiatan", dir: "asc" });
    expect(sorted.map((e) => `${e.activityName} ${e.effectiveStartTime}`)).toEqual([
      "Arisan 08:00",
      "Arisan 20:00",
      "Kajian 19:00",
    ]);
    expect(entries[0].activityName).toBe("Kajian");
  });
});
