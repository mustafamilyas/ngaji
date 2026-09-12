import { describe, expect, it } from "vitest";
import { activitySchema } from "./activity";

function base(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    groupId: 1,
    name: "Kajian Rutin",
    location: "Masjid Al-Ikhlas",
    startTime: "19:00",
    durationMinutes: 60,
    freq: "ONCE",
    interval: 1,
    weekdays: [],
    startsOn: "2026-09-09",
    endsOn: "2026-09-09",
    ...overrides,
  };
}

describe("activitySchema", () => {
  it("accepts a valid ONCE activity", () => {
    expect(activitySchema.safeParse(base()).success).toBe(true);
  });

  it("accepts a valid DAILY activity", () => {
    const result = activitySchema.safeParse(
      base({ freq: "DAILY", interval: 3, endsOn: undefined }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects when start time plus duration crosses midnight", () => {
    const result = activitySchema.safeParse(
      base({ startTime: "23:30", durationMinutes: 60, endsOn: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts when start time plus duration lands exactly at midnight", () => {
    const result = activitySchema.safeParse(
      base({ startTime: "23:00", durationMinutes: 60, endsOn: undefined }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects WEEKLY without weekdays", () => {
    const result = activitySchema.safeParse(
      base({ freq: "WEEKLY", weekdays: [], endsOn: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects WEEKLY with duplicate weekdays", () => {
    const result = activitySchema.safeParse(
      base({ freq: "WEEKLY", weekdays: [2, 2], endsOn: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects WEEKLY with a weekday out of 0..6 range", () => {
    const result = activitySchema.safeParse(
      base({ freq: "WEEKLY", weekdays: [0, 7], endsOn: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a valid WEEKLY activity", () => {
    const result = activitySchema.safeParse(
      base({ freq: "WEEKLY", weekdays: [0, 3], endsOn: undefined }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects ONCE with endsOn different from startsOn", () => {
    const result = activitySchema.safeParse(
      base({ freq: "ONCE", startsOn: "2026-09-09", endsOn: "2026-09-10" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects ONCE with interval other than 1", () => {
    const result = activitySchema.safeParse(base({ freq: "ONCE", interval: 2 }));
    expect(result.success).toBe(false);
  });

  it("rejects MONTHLY without monthDay", () => {
    const result = activitySchema.safeParse(
      base({ freq: "MONTHLY", endsOn: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects MONTHLY with monthDay out of 1..31 range", () => {
    const result = activitySchema.safeParse(
      base({ freq: "MONTHLY", monthDay: 32, endsOn: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a valid MONTHLY activity", () => {
    const result = activitySchema.safeParse(
      base({ freq: "MONTHLY", monthDay: 31, endsOn: undefined }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects endsOn earlier than startsOn", () => {
    const result = activitySchema.safeParse(
      base({
        freq: "DAILY",
        startsOn: "2026-09-09",
        endsOn: "2026-09-01",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts endsOn equal to startsOn", () => {
    const result = activitySchema.safeParse(
      base({ freq: "DAILY", startsOn: "2026-09-09", endsOn: "2026-09-09" }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects interval less than 1", () => {
    const result = activitySchema.safeParse(
      base({ freq: "DAILY", interval: 0, endsOn: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a malformed startsOn date string", () => {
    const result = activitySchema.safeParse(base({ startsOn: "09-09-2026" }));
    expect(result.success).toBe(false);
  });

  it("rejects a malformed startTime string", () => {
    const result = activitySchema.safeParse(base({ startTime: "7pm" }));
    expect(result.success).toBe(false);
  });
});
