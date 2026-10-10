import { describe, expect, it } from "vitest";
import { dateSchema } from "./common";

describe("dateSchema", () => {
  it("accepts a valid date and a leap day", () => {
    expect(dateSchema().safeParse("2026-10-10").success).toBe(true);
    expect(dateSchema().safeParse("2028-02-29").success).toBe(true);
  });

  it.each(["2026-02-30", "2026-99-99", "0001-01-01", "2026-1-1", "", "abc"])("rejects %s", (value) => {
    expect(dateSchema().safeParse(value).success).toBe(false);
  });

  it("uses the supplied message", () => {
    const result = dateSchema("Tanggal lahir tidak valid").safeParse("2026-02-30");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Tanggal lahir tidak valid");
  });
});
