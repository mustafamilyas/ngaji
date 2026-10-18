import { describe, expect, it } from "vitest";
import { DEFAULT_MEMBER_COLUMNS, parseMemberColumns, serializeMemberColumns } from "./columns";

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

describe("serializeMemberColumns", () => {
  it("round-trips a selection", () => {
    expect(parseMemberColumns(serializeMemberColumns(["alamat", "grup"]))).toEqual(["grup", "alamat"]);
  });
});
