import { describe, expect, it } from "vitest";
import { DEFAULT_MEMBER_COLUMNS, MEMBER_COLUMNS, parseMemberColumns, serializeMemberColumns } from "./columns";

describe("parseMemberColumns", () => {
  it("uses the defaults when nothing has been chosen yet", () => {
    expect(parseMemberColumns(undefined)).toEqual(DEFAULT_MEMBER_COLUMNS);
  });

  it("keeps only known columns, in table order, without duplicates", () => {
    expect(parseMemberColumns("hp,grup,bogus,grup,whatsapp")).toEqual(["whatsapp", "grup", "hp"]);
  });

  it("supports an explicit empty choice (name column only)", () => {
    expect(parseMemberColumns(serializeMemberColumns([]))).toEqual([]);
  });

  it("falls back to the defaults for a value with no known column", () => {
    expect(parseMemberColumns("bogus,,")).toEqual(DEFAULT_MEMBER_COLUMNS);
  });
});

describe("tag column (task 5.4)", () => {
  it("is a default column placed right after status", () => {
    const keys = MEMBER_COLUMNS.map((c) => c.key);
    expect(keys.indexOf("tag")).toBe(keys.indexOf("status") + 1);
    expect(DEFAULT_MEMBER_COLUMNS).toContain("tag");
  });

  it("can be hidden by choosing the other columns", () => {
    expect(parseMemberColumns("grup,status")).not.toContain("tag");
  });
});

describe("serializeMemberColumns", () => {
  it("round-trips a selection", () => {
    expect(parseMemberColumns(serializeMemberColumns(["alamat", "grup"]))).toEqual(["grup", "alamat"]);
  });
});
