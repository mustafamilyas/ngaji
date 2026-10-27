import { describe, expect, it } from "vitest";
import { endingDeletesActivity } from "./end";

describe("endingDeletesActivity", () => {
  it("is false when the date is after the start date", () => {
    expect(endingDeletesActivity("2026-03-01", "2026-03-02")).toBe(false);
    expect(endingDeletesActivity("2026-03-01", "2027-01-01")).toBe(false);
  });

  it("is true on the start date and before it", () => {
    expect(endingDeletesActivity("2026-03-01", "2026-03-01")).toBe(true);
    expect(endingDeletesActivity("2026-03-01", "2020-01-01")).toBe(true);
  });

  it("is false while no date has been chosen", () => {
    expect(endingDeletesActivity("2026-03-01", "")).toBe(false);
  });
});
