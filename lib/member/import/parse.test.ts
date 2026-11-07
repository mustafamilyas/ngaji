import { describe, expect, it } from "vitest";
import { MAX_IMPORT_ROWS } from "@/lib/constants";
import { parseCsv } from "./parse";

describe("parseCsv", () => {
  it("reads a comma-separated file", () => {
    expect(parseCsv("nama,alamat\nBudi,Bandung\n")).toEqual({
      ok: true,
      headers: ["nama", "alamat"],
      rows: [{ rowNumber: 2, cells: ["Budi", "Bandung"] }],
    });
  });

  it("reads a semicolon-separated file", () => {
    expect(parseCsv("nama;alamat\r\nBudi;Bandung\r\n")).toEqual({
      ok: true,
      headers: ["nama", "alamat"],
      rows: [{ rowNumber: 2, cells: ["Budi", "Bandung"] }],
    });
  });

  it("keeps commas inside cells of a semicolon file", () => {
    expect(parseCsv("nama;alamat\nBudi;Jl. Mawar, No. 5\n")).toMatchObject({
      rows: [{ cells: ["Budi", "Jl. Mawar, No. 5"] }],
    });
  });

  it("picks the separator from the header line alone in a file with bare CR line endings", () => {
    expect(parseCsv("nama;alamat\rBudi;Jl. Mawar, No. 5, Blok A, RT 1\r")).toMatchObject({
      headers: ["nama", "alamat"],
      rows: [{ cells: ["Budi", "Jl. Mawar, No. 5, Blok A, RT 1"] }],
    });
  });

  it("keeps a newline inside a quoted cell and counts it as one spreadsheet row", () => {
    expect(parseCsv('nama,alamat\nBudi,"Jl. Mawar\nNo. 5"\nSiti,Garut\n')).toMatchObject({
      rows: [
        { rowNumber: 2, cells: ["Budi", "Jl. Mawar\nNo. 5"] },
        { rowNumber: 3, cells: ["Siti", "Garut"] },
      ],
    });
  });

  it("keeps a quoted newline in a CRLF file", () => {
    expect(parseCsv('nama,alamat\r\nBudi,"Jl. Mawar\nNo. 5"\r\nSiti,Garut\r\n')).toMatchObject({
      rows: [
        { rowNumber: 2, cells: ["Budi", "Jl. Mawar\nNo. 5"] },
        { rowNumber: 3, cells: ["Siti", "Garut"] },
      ],
    });
  });

  it("skips rows of empty cells without renumbering the rows after them", () => {
    expect(parseCsv("nama;alamat\nBudi;Bandung\n;\n  ; \n\nSiti;Garut\n;\n;\n")).toMatchObject({
      rows: [
        { rowNumber: 2, cells: ["Budi", "Bandung"] },
        { rowNumber: 6, cells: ["Siti", "Garut"] },
      ],
    });
  });

  it("treats a quote inside an unquoted cell as text", () => {
    expect(parseCsv('nama,alamat\nBudi "Bud" S,Bandung\n')).toMatchObject({
      rows: [{ cells: ['Budi "Bud" S', "Bandung"] }],
    });
  });

  it("rejects a file with a quote that never closes", () => {
    const result = parseCsv('nama,alamat\nBudi,"Jl. Mawar\nSiti,Garut\n');
    expect(result).toEqual({ ok: false, error: expect.stringContaining("Tanda kutip") });
  });

  it("rejects text after a closing quote", () => {
    const result = parseCsv('nama,alamat\n"Budi"x,Bandung\n');
    expect(result).toEqual({ ok: false, error: expect.stringContaining("Tanda kutip") });
  });

  it("never repeats cell values in an error", () => {
    const result = parseCsv('nama,alamat\nRahasia,"Jl. Mawar\n');
    expect(JSON.stringify(result)).not.toMatch(/Rahasia|Mawar/);
  });

  it.each([
    ["an empty file", ""],
    ["a header-only file", "nama,alamat\n"],
    ["a header followed by empty rows", "nama;alamat\n;\n;\n"],
  ])("reports no data for %s", (_name, text) => {
    expect(parseCsv(text)).toEqual({ ok: false, error: expect.stringContaining("tidak berisi data") });
  });

  it("accepts exactly the row limit", () => {
    const text = `nama\n${"Budi\n".repeat(MAX_IMPORT_ROWS)}`;
    const result = parseCsv(text);
    expect(result.ok && result.rows).toHaveLength(MAX_IMPORT_ROWS);
  });

  it("rejects a file over the row limit and states the limit", () => {
    const text = `nama\n${"Budi\n".repeat(MAX_IMPORT_ROWS + 1)}`;
    expect(parseCsv(text)).toEqual({ ok: false, error: expect.stringContaining(String(MAX_IMPORT_ROWS)) });
  });

  it("does not count empty rows towards the row limit", () => {
    const text = `nama\n${"Budi\n".repeat(MAX_IMPORT_ROWS)}\n\n\n`;
    expect(parseCsv(text).ok).toBe(true);
  });
});
