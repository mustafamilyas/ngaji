import { describe, expect, it } from "vitest";
import { IMPORT_COLUMNS, matchColumns } from "./columns";
import { decodeCsv } from "./decode";
import { importTemplateCsv } from "./template";

describe("importTemplateCsv", () => {
  const text = importTemplateCsv();

  it("starts with a BOM so Excel reads it as UTF-8", () => {
    expect(text.charCodeAt(0)).toBe(0xfeff);
  });

  it("holds only the header row, with no example member", () => {
    const lines = text.slice(1).split(/\r\n/).filter(Boolean);
    expect(lines).toHaveLength(1);
  });

  it("lists every column from columns.ts except grup, in order", () => {
    const header = text.slice(1).trim().split(",");
    expect(header).toEqual(IMPORT_COLUMNS.map((column) => column.key).filter((key) => key !== "grup"));
  });

  it("is a header the importer accepts", () => {
    const decoded = decodeCsv(new TextEncoder().encode(text));
    const match = matchColumns(decoded.trim().split(","));
    expect(match.missing).toEqual([]);
    expect(match.repeated).toEqual([]);
    expect(match.ignored).toEqual([]);
  });
});
