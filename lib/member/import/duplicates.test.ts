import { describe, expect, it } from "vitest";
import { duplicateKey, markDuplicates } from "./duplicates";

const budi = { name: "Budi Santoso", birthDate: "1990-03-05" };

describe("duplicateKey", () => {
  it("ignores case", () => {
    expect(duplicateKey("BUDI SANTOSO", "1990-03-05")).toBe(duplicateKey("budi santoso", "1990-03-05"));
  });

  it("trims and collapses spaces", () => {
    expect(duplicateKey("  Budi   Santoso ", "1990-03-05")).toBe(duplicateKey("Budi Santoso", "1990-03-05"));
  });

  it("collapses tabs and non-breaking spaces", () => {
    expect(duplicateKey("Budi\t Santoso", "1990-03-05")).toBe(duplicateKey("Budi Santoso", "1990-03-05"));
  });

  it("tells different birth dates apart", () => {
    expect(duplicateKey("Budi Santoso", "1990-03-05")).not.toBe(duplicateKey("Budi Santoso", "1990-03-06"));
  });

  it("tells different names apart", () => {
    expect(duplicateKey("Budi Santoso", "1990-03-05")).not.toBe(duplicateKey("Budi Santosa", "1990-03-05"));
  });
});

describe("markDuplicates", () => {
  it("marks a row that matches an existing member", () => {
    const existing = new Set([duplicateKey("budi  santoso", "1990-03-05")]);
    expect(markDuplicates([budi], existing)).toEqual([true]);
  });

  it("marks the later of two matching rows, not the first", () => {
    const twin = { name: " BUDI santoso", birthDate: "1990-03-05" };
    expect(markDuplicates([budi, twin], new Set())).toEqual([false, true]);
  });

  it("marks every later copy when one row repeats three times", () => {
    expect(markDuplicates([budi, budi, budi], new Set())).toEqual([false, true, true]);
  });

  it("does not match rows that differ in name or birth date", () => {
    const rows = [budi, { ...budi, name: "Budi Hartono" }, { ...budi, birthDate: "1991-03-05" }];
    expect(markDuplicates(rows, new Set())).toEqual([false, false, false]);
  });

  it("never marks a row without a usable name and birth date, and never lets it match others", () => {
    expect(markDuplicates([null, budi, null], new Set())).toEqual([false, false, false]);
  });

  it("returns an empty list for no rows", () => {
    expect(markDuplicates([], new Set())).toEqual([]);
  });
});
