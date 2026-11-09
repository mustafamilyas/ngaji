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
  it("is a default column placed first after the always-shown name, so a tablet sees it without scrolling (task 8.26)", () => {
    expect(MEMBER_COLUMNS[0].key).toBe("tag");
    expect(DEFAULT_MEMBER_COLUMNS[0]).toBe("tag");
  });

  it("keeps the order of the other default columns", () => {
    expect(DEFAULT_MEMBER_COLUMNS).toEqual(["tag", "whatsapp", "grup", "jenisKelamin", "tanggalLahir", "status"]);
  });

  it("puts a saved choice in the new order, so an old cookie needs no migration", () => {
    expect(parseMemberColumns("whatsapp,grup,status,tag")).toEqual(["tag", "whatsapp", "grup", "status"]);
  });

  it("can be hidden by choosing the other columns", () => {
    expect(parseMemberColumns("grup,status")).not.toContain("tag");
  });
});

describe("kode column (member-code spec \"Display\")", () => {
  it("is an optional column labelled Kode, hidden by default", () => {
    expect(MEMBER_COLUMNS.find((c) => c.key === "kode")).toEqual({ key: "kode", label: "Kode", defaultVisible: false });
    expect(DEFAULT_MEMBER_COLUMNS).not.toContain("kode");
  });

  it("can be chosen from a saved cookie", () => {
    expect(parseMemberColumns("kode,grup")).toEqual(["grup", "kode"]);
  });
});

describe("serializeMemberColumns", () => {
  it("round-trips a selection", () => {
    expect(parseMemberColumns(serializeMemberColumns(["alamat", "grup"]))).toEqual(["grup", "alamat"]);
  });
});
