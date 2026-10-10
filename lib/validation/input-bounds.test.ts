import { describe, expect, it } from "vitest";
import { activitySchema, activitySplitSchema, deleteActivitySchema, endActivitySchema } from "./activity";
import { attendanceSaveSchema, checkInSchema } from "./attendance";
import { idSchema } from "./common";
import { createMemberSchema } from "./member";
import { occurrenceOverrideSchema } from "./occurrence";

function activity(overrides: Partial<Record<string, unknown>> = {}) {
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

function member(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    groupId: 1,
    name: "Anggota Uji",
    birthPlace: "Jakarta",
    birthDate: "2000-01-01",
    sex: "L",
    address: "Jl. Uji No. 1",
    phone: "081200000000",
    maritalStatus: "BELUM_MENIKAH",
    workStatus: "BEKERJA",
    status: "AKTIF",
    joinedAt: "2024-01-01",
    ...overrides,
  };
}

describe("member dates", () => {
  it("rejects an impossible birth date with the field message", () => {
    const result = createMemberSchema.safeParse(member({ birthDate: "2026-02-30" }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Tanggal lahir tidak valid");
  });

  it("rejects an impossible joinedAt and exitedAt", () => {
    expect(createMemberSchema.safeParse(member({ joinedAt: "2026-99-99" })).success).toBe(false);
    expect(
      createMemberSchema.safeParse(member({ status: "KELUAR", exitedAt: "2026-02-30" })).success,
    ).toBe(false);
  });
});

describe("activity dates", () => {
  it("rejects an out-of-range year", () => {
    expect(activitySchema.safeParse(activity({ startsOn: "0001-01-01", endsOn: "0001-01-01" })).success).toBe(false);
  });

  it("accepts a valid leap day", () => {
    expect(activitySchema.safeParse(activity({ startsOn: "2028-02-29", endsOn: "2028-02-29" })).success).toBe(true);
  });

  it("rejects an impossible endsOn and endActivity fromDate", () => {
    expect(activitySchema.safeParse(activity({ endsOn: "2026-02-30" })).success).toBe(false);
    expect(endActivitySchema.safeParse({ activityId: 1, fromDate: "2026-02-30" }).success).toBe(false);
  });
});

describe("occurrence and attendance dates", () => {
  it("rejects impossible dates in occurrence override, attendance save and check-in", () => {
    expect(occurrenceOverrideSchema.safeParse({ activityId: 1, date: "2026-02-30", status: "CANCELLED" }).success).toBe(false);
    expect(
      occurrenceOverrideSchema.safeParse({ activityId: 1, date: "2026-09-09", status: "SCHEDULED", overrideDate: "2026-99-99" }).success,
    ).toBe(false);
    expect(attendanceSaveSchema.safeParse({ activityId: 1, groupId: 1, date: "2026-02-30", entries: [] }).success).toBe(false);
    expect(checkInSchema.safeParse({ activityId: 1, groupId: 1, date: "2026-02-30", memberId: 1 }).success).toBe(false);
  });
});

describe("free text max lengths", () => {
  it("rejects oversized activity name, location and notes; accepts the limits", () => {
    expect(activitySchema.safeParse(activity({ name: "a".repeat(201) })).success).toBe(false);
    expect(activitySchema.safeParse(activity({ location: "a".repeat(201) })).success).toBe(false);
    expect(activitySchema.safeParse(activity({ notes: "a".repeat(5000) })).success).toBe(false);
    expect(activitySchema.safeParse(activity({ name: "a".repeat(200), location: "a".repeat(200), notes: "a".repeat(1000) })).success).toBe(true);
  });

  it("rejects oversized occurrence override location and notes", () => {
    const base = { activityId: 1, date: "2026-09-09", status: "SCHEDULED" };
    expect(occurrenceOverrideSchema.safeParse({ ...base, overrideLocation: "a".repeat(1000) }).success).toBe(false);
    expect(occurrenceOverrideSchema.safeParse({ ...base, overrideNotes: "a".repeat(1001) }).success).toBe(false);
    expect(occurrenceOverrideSchema.safeParse({ ...base, overrideLocation: "a".repeat(200), overrideNotes: "a".repeat(1000) }).success).toBe(true);
  });
});

describe("array bounds", () => {
  it("rejects 5000 attendance entries and accepts 1000", () => {
    const entries = (n: number) => Array.from({ length: n }, (_, i) => ({ memberId: i + 1, status: "HADIR" }));
    const base = { activityId: 1, groupId: 1, date: "2026-09-09" };
    expect(attendanceSaveSchema.safeParse({ ...base, entries: entries(5000) }).success).toBe(false);
    expect(attendanceSaveSchema.safeParse({ ...base, entries: entries(1000) }).success).toBe(true);
  });

  it("rejects more than 7 weekdays", () => {
    const result = activitySchema.safeParse(activity({ freq: "WEEKLY", weekdays: [0, 1, 2, 3, 4, 5, 6, 0] }));
    expect(result.success).toBe(false);
  });
});

describe("activity id", () => {
  it("idSchema accepts positive integers and rejects everything else", () => {
    expect(idSchema.safeParse(7).success).toBe(true);
    expect(idSchema.safeParse("7").success).toBe(true);
    for (const bad of ["abc", 0, -1, 1.5, null, undefined, ""]) {
      expect(idSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects a non-numeric activity id in the id schemas", () => {
    expect(deleteActivitySchema.safeParse({ activityId: "abc" }).success).toBe(false);
    expect(activitySplitSchema.safeParse({ ...activity(), groupId: undefined, activityId: "abc" }).success).toBe(false);
  });
});
