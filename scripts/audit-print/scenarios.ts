import type Database from "better-sqlite3";
import { addDays } from "@/lib/dates";
import { MAX_LOCATION_LENGTH, MAX_NOTES_LENGTH } from "@/lib/constants";

export type Range = { from: string; to: string };

export type Scenario = {
  name: string;
  description: string;
  /** The printed range, from the organization's "today" (`YYYY-MM-DD`). */
  range: (today: string) => Range;
  /** Most pages the print may take; null = only report the number (a known, accepted cost). */
  maxPages: number | null;
  /** Changes the scratch database before this scenario is printed. */
  prepare?: (db: Database.Database) => void;
};

export type Result = {
  name: string;
  description: string;
  rows: number;
  pages: number;
  maxPages: number | null;
  file: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** First day of the month before `today`'s month, to the last day of `today`'s month. */
function twoMonths(today: string): Range {
  const [year, month] = today.split("-").map(Number);
  const prev = new Date(Date.UTC(year, month - 2, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-01`, to: `${year}-${pad(month)}-${pad(lastDay)}` };
}

const filler = (length: number) => "Mohon membawa perlengkapan masing-masing dan hadir tepat waktu. ".repeat(40).slice(0, length).trim();

export const SCENARIOS: Scenario[] = [
  {
    name: "week",
    description: "a typical week from today",
    range: (today) => ({ from: today, to: addDays(today, 6) }),
    maxPages: 1,
  },
  {
    name: "two-months",
    description: "last month and this month (the longest everyday print)",
    range: twoMonths,
    // 37 rows took 2 pages when this was measured (task 10.20); one page of headroom.
    maxPages: 3,
  },
  {
    name: "long-text",
    description: `two weeks with maximum-length text (notes ${MAX_NOTES_LENGTH}, location ${MAX_LOCATION_LENGTH} characters)`,
    range: (today) => ({ from: today, to: addDays(today, 13) }),
    // Accepted cost (task 10.36): a hand-out keeps the complete text, so tall rows take extra pages. Reported only.
    maxPages: null,
    prepare: (db) => {
      const activities = db.prepare("SELECT id FROM Activity WHERE deletedAt IS NULL").all() as { id: number }[];
      const update = db.prepare("UPDATE Activity SET notes = ?, location = ? WHERE id = ?");
      for (const { id } of activities) {
        update.run(filler(id % 2 ? 300 : MAX_NOTES_LENGTH), filler(MAX_LOCATION_LENGTH), id);
      }
    },
  },
];

/** A human-readable defect, or null when the scenario is within its budget. */
export function evaluate(result: Result): string | null {
  if (result.rows === 0) return `${result.name}: no occurrences in the range, nothing was measured`;
  if (result.pages === 0) return `${result.name}: no pages were printed`;
  if (result.maxPages !== null && result.pages > result.maxPages) {
    return `${result.name}: ${result.pages} pages, at most ${result.maxPages} allowed`;
  }
  return null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function formatReport(results: Result[]): string {
  const lines = results.map((result) => {
    const defect = evaluate(result);
    const budget = result.maxPages === null ? "report only" : `budget ${result.maxPages}`;
    const verdict = defect ? "FAIL" : "ok";
    const row = `  ${result.name.padEnd(12)} ${plural(result.rows, "row", "rows").padEnd(9)} ${plural(result.pages, "page", "pages").padEnd(8)} ${budget.padEnd(12)} ${verdict}`;
    return defect ? `${row}\n      ${defect}` : row;
  });
  return ["Print audit (A4 portrait, default margins):", ...lines].join("\n");
}
