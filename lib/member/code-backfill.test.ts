import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { parseBackfillArgs, planPrefixes } from "./code-backfill";

describe("parseBackfillArgs", () => {
  it("maps organization ids to uppercased prefixes", () => {
    expect(parseBackfillArgs(["1=ANR", "2=xyz"])).toEqual(new Map([[1, "ANR"], [2, "XYZ"]]));
  });

  it("accepts no arguments", () => {
    expect(parseBackfillArgs([])).toEqual(new Map());
  });

  it.each([["1"], ["x=ANR"], ["0=ANR"], ["1=A1"], ["1=ABCDE"], ["--prefix"], ["1=ANR=X"]])("rejects %j", (arg) => {
    expect(() => parseBackfillArgs([arg])).toThrow(ValidationError);
  });

  it("rejects the same organization twice", () => {
    expect(() => parseBackfillArgs(["1=ANR", "1=XYZ"])).toThrow(/more than once/);
  });
});

describe("planPrefixes", () => {
  const org = (id: number, memberCodePrefix: string | null = null) => ({ id, name: `Org ${id}`, memberCodePrefix });

  it("returns the prefixes to set for organizations without one", () => {
    expect(planPrefixes([org(1), org(2, "XYZ")], new Map([[1, "ANR"]]))).toEqual(new Map([[1, "ANR"]]));
  });

  it("returns nothing when every organization already has a prefix", () => {
    expect(planPrefixes([org(1, "ANR")], new Map())).toEqual(new Map());
  });

  it("accepts the prefix an organization already has, so a re-run with the same arguments is a no-op", () => {
    expect(planPrefixes([org(1, "ANR")], new Map([[1, "ANR"]]))).toEqual(new Map());
  });

  it("refuses to change an existing prefix", () => {
    expect(() => planPrefixes([org(1, "ANR")], new Map([[1, "XYZ"]]))).toThrow(/already has prefix ANR/);
  });

  it("refuses an unknown organization id", () => {
    expect(() => planPrefixes([org(1)], new Map([[1, "ANR"], [9, "XYZ"]]))).toThrow(/9/);
  });

  it("refuses partial coverage and names every organization left without a prefix", () => {
    expect(() => planPrefixes([org(1), org(2), org(3)], new Map([[1, "ANR"]]))).toThrow(/2 \(Org 2\), 3 \(Org 3\)/);
  });

  it("refuses a prefix another organization already uses", () => {
    expect(() => planPrefixes([org(1), org(2, "ANR")], new Map([[1, "ANR"]]))).toThrow(/ANR.*already used/);
  });

  it("refuses the same prefix for two organizations", () => {
    expect(() => planPrefixes([org(1), org(2)], new Map([[1, "ANR"], [2, "ANR"]]))).toThrow(/ANR.*already used/);
  });
});
