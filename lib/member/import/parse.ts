import Papa from "papaparse";
import { MAX_IMPORT_ROWS } from "@/lib/constants";

export type CsvRow = {
  /** Row number as the spreadsheet shows it: the header is row 1, and skipped empty rows still count. */
  rowNumber: number;
  cells: string[];
};

export type ParsedCsv = { ok: true; headers: string[]; rows: CsvRow[] } | { ok: false; error: string };

/** The header line decides the separator; Excel writes `;` under an Indonesian locale. */
function detectDelimiter(text: string): "," | ";" {
  const [headerLine] = text.split(/\r\n?|\n/, 1);
  const count = (separator: string) => headerLine.split(separator).length;
  return count(";") > count(",") ? ";" : ",";
}

/** Errors here are fixed text: they never repeat cell values, which are member PII. */
export function parseCsv(text: string): ParsedCsv {
  const { data, errors } = Papa.parse<string[]>(text, { delimiter: detectDelimiter(text) });
  if (errors.some((error) => error.type === "Quotes")) {
    return { ok: false, error: "Tanda kutip di file tidak seimbang. Simpan ulang file sebagai CSV lalu unggah lagi." };
  }

  const [headers = [], ...body] = data;
  const rows: CsvRow[] = [];
  body.forEach((cells, index) => {
    if (cells.some((cell) => cell.trim() !== "")) rows.push({ rowNumber: index + 2, cells });
  });

  if (rows.length === 0) return { ok: false, error: "File tidak berisi data." };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: `File melebihi batas ${MAX_IMPORT_ROWS} baris.` };
  }
  return { ok: true, headers, rows };
}
