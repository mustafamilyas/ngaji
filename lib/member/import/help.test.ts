import { describe, expect, it } from "vitest";
import { MARITAL_STATUSES, MEMBER_STATUSES, SEXES, WORK_STATUSES } from "@/lib/validation/enums";
import { IMPORT_COLUMNS } from "./columns";
import { COLUMN_HELP } from "./help";

describe("COLUMN_HELP", () => {
  it("has text for every column in columns.ts and none for others", () => {
    expect(Object.keys(COLUMN_HELP).sort()).toEqual(IMPORT_COLUMNS.map((column) => column.key).sort());
    for (const text of Object.values(COLUMN_HELP)) expect(text.trim()).not.toBe("");
  });

  it.each([
    ["jenis_kelamin", SEXES],
    ["status_nikah", MARITAL_STATUSES],
    ["pekerjaan", WORK_STATUSES],
    ["status", MEMBER_STATUSES],
  ] as const)("lists every accepted value of %s", (key, values) => {
    for (const value of values) expect(COLUMN_HELP[key]).toContain(value);
  });

  it("states the day-first date rule", () => {
    expect(COLUMN_HELP.tanggal_lahir).toMatch(/hari/i);
  });
});
