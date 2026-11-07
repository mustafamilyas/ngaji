import { describe, expect, it } from "vitest";
import { parseImportDate } from "./dates";

describe("parseImportDate", () => {
  it("keeps an ISO date as it is", () => {
    expect(parseImportDate("1990-03-05")).toBe("1990-03-05");
  });

  it("reads day-first with slashes", () => {
    expect(parseImportDate("05/03/1990")).toBe("1990-03-05");
  });

  it("reads day-first with dashes", () => {
    expect(parseImportDate("05-03-1990")).toBe("1990-03-05");
  });

  it("reads a day and month without zero padding", () => {
    expect(parseImportDate("5/3/1990")).toBe("1990-03-05");
  });

  it("ignores spaces around the cell", () => {
    expect(parseImportDate("  05/03/1990 ")).toBe("1990-03-05");
  });

  it("rejects an impossible date", () => {
    expect(parseImportDate("31/02/1990")).toBeNull();
    expect(parseImportDate("1990-02-30")).toBeNull();
  });

  it("rejects a two-digit year", () => {
    expect(parseImportDate("05/03/90")).toBeNull();
  });

  it("rejects a spreadsheet serial number", () => {
    expect(parseImportDate("32874")).toBeNull();
  });

  it("rejects mixed separators", () => {
    expect(parseImportDate("5/3-1990")).toBeNull();
  });

  it("rejects an ISO date with a time part", () => {
    expect(parseImportDate("1990-03-05 10:00")).toBeNull();
  });

  it("rejects years outside the app's range", () => {
    expect(parseImportDate("05/03/1800")).toBeNull();
    expect(parseImportDate("05/03/2101")).toBeNull();
  });

  it("rejects an empty cell", () => {
    expect(parseImportDate("")).toBeNull();
    expect(parseImportDate("   ")).toBeNull();
  });
});
