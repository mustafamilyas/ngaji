import { describe, expect, it } from "vitest";
import type { ActivityListEntry } from "@/lib/activity/list";
import { endTimeOf, groupScheduleByDate } from "./print";

function entry(overrides: Partial<ActivityListEntry>): ActivityListEntry {
  return {
    activityId: 1,
    activityName: "Kajian",
    groupId: 1,
    groupName: "Kelompok A",
    key: "2026-01-04",
    effectiveDate: "2026-01-04",
    effectiveStartTime: "19:00",
    effectiveDurationMinutes: 60,
    effectiveLocation: "Masjid",
    effectiveNotes: null,
    status: "SCHEDULED",
    inherited: false,
    moved: false,
    hasConflict: false,
    canEdit: false,
    canRecord: false,
    ...overrides,
  };
}

describe("endTimeOf", () => {
  it("adds the duration to the start", () => {
    expect(endTimeOf("19:00", 90)).toBe("20:30");
  });

  it("wraps past midnight", () => {
    expect(endTimeOf("23:30", 60)).toBe("00:30");
  });
});

describe("groupScheduleByDate", () => {
  it("returns nothing for empty input", () => {
    expect(groupScheduleByDate([], { showCancelled: true })).toEqual([]);
  });

  it("groups by effective date in ascending order, then orders by time and name", () => {
    const groups = groupScheduleByDate(
      [
        entry({ activityId: 1, activityName: "B", effectiveDate: "2026-01-05", effectiveStartTime: "08:00" }),
        entry({ activityId: 2, activityName: "Z", effectiveDate: "2026-01-04", effectiveStartTime: "19:00" }),
        entry({ activityId: 3, activityName: "A", effectiveDate: "2026-01-04", effectiveStartTime: "19:00" }),
        entry({ activityId: 4, activityName: "Y", effectiveDate: "2026-01-04", effectiveStartTime: "07:00" }),
      ],
      { showCancelled: true },
    );
    expect(groups.map((g) => g.date)).toEqual(["2026-01-04", "2026-01-05"]);
    expect(groups[0].entries.map((e) => e.activityName)).toEqual(["Y", "A", "Z"]);
  });

  it("files a moved entry under its effective date", () => {
    const groups = groupScheduleByDate(
      [entry({ key: "2026-01-04", effectiveDate: "2026-01-05", moved: true })],
      { showCancelled: true },
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe("2026-01-05");
  });

  it("shows or hides cancelled entries and omits a date left empty", () => {
    const input = [
      entry({ activityId: 1, effectiveDate: "2026-01-04" }),
      entry({ activityId: 2, effectiveDate: "2026-01-05", status: "CANCELLED" }),
    ];
    expect(groupScheduleByDate(input, { showCancelled: true }).map((g) => g.date)).toEqual(["2026-01-04", "2026-01-05"]);
    expect(groupScheduleByDate(input, { showCancelled: false }).map((g) => g.date)).toEqual(["2026-01-04"]);
  });
});
