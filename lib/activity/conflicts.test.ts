import { describe, expect, it } from "vitest";
import { findConflicts, type ConflictCandidate } from "./conflicts";

function candidate(overrides: Partial<ConflictCandidate>): ConflictCandidate {
  return {
    id: "a",
    groupPath: "1/5/12/",
    effectiveDate: "2026-09-10",
    effectiveStartTime: "19:00",
    effectiveDurationMinutes: 60,
    status: "SCHEDULED",
    ...overrides,
  };
}

describe("findConflicts", () => {
  it("does not flag windows that only touch at the boundary", () => {
    const a = candidate({ id: "a", effectiveStartTime: "10:00", effectiveDurationMinutes: 60 });
    const b = candidate({ id: "b", effectiveStartTime: "11:00", effectiveDurationMinutes: 60 });
    expect(findConflicts([a, b])).toEqual([]);
  });

  it("flags an overlap between an ancestor group and a descendant group", () => {
    const daerah = candidate({
      id: "daerah",
      groupPath: "1/5/",
      effectiveStartTime: "19:00",
      effectiveDurationMinutes: 90, // 19:00-20:30
    });
    const kelompok = candidate({
      id: "kelompok",
      groupPath: "1/5/12/",
      effectiveStartTime: "20:00",
      effectiveDurationMinutes: 60, // 20:00-21:00
    });
    expect(findConflicts([daerah, kelompok])).toEqual([{ a: "daerah", b: "kelompok" }]);
  });

  it("never flags overlapping activities in sibling branches", () => {
    const k1 = candidate({ id: "k1", groupPath: "1/5/12/", effectiveStartTime: "19:00" });
    const k2 = candidate({ id: "k2", groupPath: "1/5/13/", effectiveStartTime: "19:00" });
    expect(findConflicts([k1, k2])).toEqual([]);
  });

  it("ignores CANCELLED occurrences", () => {
    const a = candidate({ id: "a", effectiveStartTime: "19:00", status: "CANCELLED" });
    const b = candidate({ id: "b", effectiveStartTime: "19:00", status: "SCHEDULED" });
    expect(findConflicts([a, b])).toEqual([]);
  });

  it("flags a same-group overlap on the same date", () => {
    const a = candidate({ id: "a", effectiveStartTime: "19:00", effectiveDurationMinutes: 60 });
    const b = candidate({ id: "b", effectiveStartTime: "19:30", effectiveDurationMinutes: 60 });
    expect(findConflicts([a, b])).toEqual([{ a: "a", b: "b" }]);
  });

  it("does not flag the same groups on different dates", () => {
    const a = candidate({ id: "a", effectiveDate: "2026-09-10" });
    const b = candidate({ id: "b", effectiveDate: "2026-09-11" });
    expect(findConflicts([a, b])).toEqual([]);
  });
});
