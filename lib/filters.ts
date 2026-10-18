/**
 * Parsers for the shared list filter URL contract (`components/filters/*`):
 * `q` (name search), `grup` (comma-separated group ids), `range` / `anchor`
 * / `from` / `to` (date range), `page`. Everything from the URL is untrusted:
 * these only normalize shape — group ids must still be resolved and
 * scope-checked server-side by the caller.
 */
import { MAX_GROUP_FILTER_IDS } from "@/lib/constants";
import { addDays, addMonthsOnDay, daysBetween, isDateString, monthStartOf, rangeForMode, today as todayInJakarta } from "@/lib/dates";

type Param = string | string[] | undefined;

const MAX_SEARCH_LENGTH = 100;

function first(param: Param): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

export function parseGroupIds(param: Param): number[] | undefined {
  const raw = first(param);
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((part) => Number(part))
    .filter((n) => Number.isInteger(n) && n > 0);
  const unique = [...new Set(ids)].slice(0, MAX_GROUP_FILTER_IDS);
  return unique.length > 0 ? unique : undefined;
}

export function parseSearch(param: Param): string | undefined {
  const value = first(param)?.trim();
  return value ? value.slice(0, MAX_SEARCH_LENGTH) : undefined;
}

export function parsePage(param: Param): number {
  const value = Number(first(param));
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
}

/**
 * Date range modes: calendar periods around `anchor` (`hari`, `minggu`,
 * `bulan`), rolling windows of N days ending on `anchor` (`7h`, `30h`,
 * `90h`), no bound (`semua`), or explicit `from`/`to` (`custom`).
 */
export const DATE_RANGE_MODES = ["hari", "minggu", "bulan", "7h", "30h", "90h", "semua", "custom"] as const;
export type DateRangeMode = (typeof DATE_RANGE_MODES)[number];

export const DATE_RANGE_LABELS: Record<DateRangeMode, string> = {
  hari: "Hari ini",
  minggu: "Minggu ini",
  bulan: "Bulan ini",
  "7h": "7 hari terakhir",
  "30h": "30 hari terakhir",
  "90h": "90 hari terakhir",
  semua: "Semua waktu",
  custom: "Pilih tanggal",
};

const ROLLING_DAYS: Partial<Record<DateRangeMode, number>> = { "7h": 7, "30h": 30, "90h": 90 };

export type DateRangeConfig = {
  /** Modes offered on this page, in display order. */
  modes: readonly DateRangeMode[];
  defaultMode: DateRangeMode;
};

export type DateRange = {
  mode: DateRangeMode;
  anchor: string;
  /** Undefined = unbounded (only for `semua`, or a half-open custom range on a page whose default is open). */
  from: string | undefined;
  to: string | undefined;
};

function rangeOf(mode: Exclude<DateRangeMode, "custom">, anchor: string): { from?: string; to?: string } {
  if (mode === "semua") return {};
  const rolling = ROLLING_DAYS[mode];
  if (rolling) return { from: addDays(anchor, -(rolling - 1)), to: anchor };
  return rangeForMode(mode as "hari" | "minggu" | "bulan", anchor);
}

export function resolveDateRange(
  params: { range?: Param; anchor?: Param; from?: Param; to?: Param },
  config: DateRangeConfig,
  today: string = todayInJakarta(),
): DateRange {
  const rawMode = first(params.range);
  const rawFrom = first(params.from);
  const rawTo = first(params.to);
  const rawAnchor = first(params.anchor);

  let mode: DateRangeMode = config.defaultMode;
  if (rawMode && (config.modes as readonly string[]).includes(rawMode)) {
    mode = rawMode as DateRangeMode;
  } else if (!rawMode && config.modes.includes("custom") && (isDateString(rawFrom) || isDateString(rawTo))) {
    mode = "custom";
  }

  const anchor = isDateString(rawAnchor) ? rawAnchor : today;

  if (mode !== "custom") {
    const { from, to } = rangeOf(mode, anchor);
    return { mode, anchor, from, to };
  }

  const fallback = config.defaultMode === "custom" ? {} : rangeOf(config.defaultMode, today);
  let from = isDateString(rawFrom) ? rawFrom : fallback.from;
  let to = isDateString(rawTo) ? rawTo : fallback.to;
  if (from && to && from > to) [from, to] = [to, from];
  return { mode, anchor, from, to };
}

/**
 * URL params for the previous (`-1`) or next (`1`) range of the same size,
 * or null when the range is unbounded and so cannot be stepped.
 */
export function shiftDateRange(range: DateRange, direction: 1 | -1): Record<string, string> | null {
  const { mode, anchor, from, to } = range;
  switch (mode) {
    case "semua":
      return null;
    case "hari":
      return { anchor: addDays(anchor, direction) };
    case "minggu":
      return { anchor: addDays(anchor, direction * 7) };
    case "bulan":
      return { anchor: addMonthsOnDay(monthStartOf(anchor), direction, 1)! };
    case "custom": {
      if (!from || !to) return null;
      const length = daysBetween(from, to) + 1;
      return { from: addDays(from, direction * length), to: addDays(to, direction * length) };
    }
    default:
      return { anchor: addDays(anchor, direction * ROLLING_DAYS[mode]!) };
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function dateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: MONTHS[month - 1], day };
}

/** "12 Mar 1990" — same deterministic formatting as `formatDateRange`. */
export function formatDate(date: string): string {
  const { day, month, year } = dateParts(date);
  return `${day} ${month} ${year}`;
}

/**
 * Short Indonesian label for a range ("4–10 Okt 2026"). Hand-rolled rather
 * than `Intl.DateTimeFormat#formatRange`, whose spacing differs between
 * Node's and browsers' ICU and so breaks hydration of client components.
 */
export function formatDateRange(from: string | undefined, to: string | undefined): string {
  if (!from && !to) return DATE_RANGE_LABELS.semua;
  if (from && !to) {
    const a = dateParts(from);
    return `sejak ${a.day} ${a.month} ${a.year}`;
  }
  if (!from && to) {
    const b = dateParts(to);
    return `s.d. ${b.day} ${b.month} ${b.year}`;
  }
  const a = dateParts(from!);
  const b = dateParts(to!);
  if (from === to) return `${a.day} ${a.month} ${a.year}`;
  if (a.year === b.year && a.month === b.month) return `${a.day}–${b.day} ${b.month} ${b.year}`;
  if (a.year === b.year) return `${a.day} ${a.month} – ${b.day} ${b.month} ${b.year}`;
  return `${a.day} ${a.month} ${a.year} – ${b.day} ${b.month} ${b.year}`;
}
