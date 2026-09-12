import { describe, expect, it } from "vitest";
import { occurrencesFor, type ActivityTemplate, type OccurrenceRow } from "./occurrences";

function activity(overrides: Partial<ActivityTemplate> = {}): ActivityTemplate {
  return {
    freq: "WEEKLY",
    interval: 1,
    weekdays: [4], // Thursday
    monthDay: null,
    startsOn: "2026-09-01",
    endsOn: null,
    startTime: "19:00",
    durationMinutes: 60,
    location: "Masjid Al-Ikhlas",
    notes: null,
    ...overrides,
  };
}

function row(overrides: Partial<OccurrenceRow>): OccurrenceRow {
  return {
    date: "2026-09-08",
    status: "SCHEDULED",
    overrideDate: null,
    overrideStartTime: null,
    overrideDurationMinutes: null,
    overrideLocation: null,
    overrideNotes: null,
    hasAttendance: false,
    ...overrides,
  };
}

describe("occurrencesFor", () => {
  it("keeps a row with attendance after the template no longer generates its date", () => {
    // Template is now Thursday-only, but 2026-09-08 (Tuesday) has attendance.
    const rows = [row({ date: "2026-09-08", hasAttendance: true })];
    const result = occurrencesFor(activity({ weekdays: [4] }), "2026-09-01", "2026-09-30", rows);
    expect(result.map((o) => o.key)).toContain("2026-09-08");
  });

  it("ignores an orphan row with no attendance whose date the rule no longer generates", () => {
    const rows = [
      row({ date: "2026-09-08", status: "CANCELLED", hasAttendance: false }),
    ];
    const result = occurrencesFor(activity({ weekdays: [4] }), "2026-09-01", "2026-09-30", rows);
    expect(result.map((o) => o.key)).not.toContain("2026-09-08");
  });

  it("shows a moved occurrence at its overrideDate, keyed by the original rule date", () => {
    const rows = [row({ date: "2026-09-10", overrideDate: "2026-09-12" })];
    const result = occurrencesFor(
      activity({ freq: "ONCE", interval: 1, weekdays: [], startsOn: "2026-09-10", endsOn: "2026-09-10" }),
      "2026-09-01",
      "2026-09-30",
      rows,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ key: "2026-09-10", effectiveDate: "2026-09-12" });
  });

  it("excludes an occurrence whose overrideDate falls outside the requested range", () => {
    const rows = [row({ date: "2026-09-10", overrideDate: "2026-10-05" })];
    const result = occurrencesFor(
      activity({ freq: "ONCE", interval: 1, weekdays: [], startsOn: "2026-09-10", endsOn: "2026-09-10" }),
      "2026-09-01",
      "2026-09-30",
      rows,
    );
    expect(result).toHaveLength(0);
  });

  it("includes a row with attendance whose overrideDate falls inside the range even if its rule date does not", () => {
    const rows = [
      row({ date: "2026-08-01", overrideDate: "2026-09-15", hasAttendance: true }),
    ];
    const result = occurrencesFor(activity({ weekdays: [4] }), "2026-09-01", "2026-09-30", rows);
    expect(result.map((o) => o.effectiveDate)).toContain("2026-09-15");
  });

  it("applies overrides for start time, duration, location, notes, and status", () => {
    const rows = [
      row({
        date: "2026-09-03",
        overrideStartTime: "20:00",
        overrideDurationMinutes: 90,
        overrideLocation: "Aula",
        overrideNotes: "Pindah ruangan",
        status: "CANCELLED",
      }),
    ];
    const result = occurrencesFor(
      activity({ freq: "ONCE", interval: 1, weekdays: [], startsOn: "2026-09-03", endsOn: "2026-09-03" }),
      "2026-09-01",
      "2026-09-30",
      rows,
    );
    expect(result[0]).toMatchObject({
      effectiveStartTime: "20:00",
      effectiveDurationMinutes: 90,
      effectiveLocation: "Aula",
      effectiveNotes: "Pindah ruangan",
      status: "CANCELLED",
    });
  });

  it("defaults to the template's own fields and SCHEDULED status when there is no row", () => {
    const result = occurrencesFor(
      activity({ freq: "ONCE", interval: 1, weekdays: [], startsOn: "2026-09-03", endsOn: "2026-09-03" }),
      "2026-09-01",
      "2026-09-30",
      [],
    );
    expect(result[0]).toMatchObject({
      effectiveStartTime: "19:00",
      effectiveDurationMinutes: 60,
      effectiveLocation: "Masjid Al-Ikhlas",
      effectiveNotes: null,
      status: "SCHEDULED",
    });
  });
});
