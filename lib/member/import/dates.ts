import { isDateString } from "@/lib/dates";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Day-first `D/M/YYYY` or `D-M-YYYY`; one separator throughout, four-digit year. */
const DAY_FIRST_RE = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/;

/** A cell as `YYYY-MM-DD`, or null when it is not a real date in an accepted form. */
export function parseImportDate(cell: string): string | null {
  const text = cell.trim();
  if (ISO_RE.test(text)) return isDateString(text) ? text : null;

  const match = DAY_FIRST_RE.exec(text);
  if (!match) return null;
  const [, day, , month, year] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return isDateString(iso) ? iso : null;
}
