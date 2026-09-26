const TIMEZONE = "Asia/Jakarta";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function assertDateString(date: string): void {
  if (!DATE_RE.test(date)) {
    throw new Error(`Invalid date string: ${date}`);
  }
}

function parseUtc(date: string): Date {
  assertDateString(date);
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Today's date in Asia/Jakarta, independent of the host's local timezone. */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Validates a YYYY-MM-DD string before it is written to a Prisma String date column. */
export function toDbDate(date: string): string {
  assertDateString(date);
  return date;
}

/** Validates a YYYY-MM-DD string read back from a Prisma String date column. */
export function fromDbDate(date: string): string {
  assertDateString(date);
  return date;
}

export function addDays(date: string, days: number): string {
  const d = parseUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return formatUtc(d);
}

/** Day of week for `date`: 0 = Sunday .. 6 = Saturday. */
export function weekdayOf(date: string): number {
  return parseUtc(date).getUTCDay();
}

/** The Sunday (start of week) of the week containing `date`. */
export function sundayOf(date: string): string {
  const d = parseUtc(date);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return formatUtc(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseUtc(to).getTime() - parseUtc(from).getTime()) / DAY_MS);
}

export function weeksBetween(from: string, to: string): number {
  return Math.floor(daysBetween(from, to) / 7);
}

/** Calendar-month difference between two dates, ignoring day-of-month. */
export function monthsBetween(from: string, to: string): number {
  const a = parseUtc(from);
  const b = parseUtc(to);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/** Whole years between `birthDate` and `asOf` (both `YYYY-MM-DD`), for age-bracket statistics. */
export function ageInYears(birthDate: string, asOf: string): number {
  assertDateString(birthDate);
  assertDateString(asOf);
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [asOfYear, asOfMonth, asOfDay] = asOf.split("-").map(Number);
  let age = asOfYear - birthYear;
  if (asOfMonth < birthMonth || (asOfMonth === birthMonth && asOfDay < birthDay)) {
    age--;
  }
  return age;
}

/**
 * `date`'s calendar month plus `months` months, on calendar day `day`.
 * Returns null when that month has fewer than `day` days (e.g. day 31 in April).
 */
export function addMonthsOnDay(date: string, months: number, day: number): string | null {
  const base = parseUtc(date);
  const totalMonths = base.getUTCFullYear() * 12 + base.getUTCMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  if (day > daysInMonth) {
    return null;
  }
  return formatUtc(new Date(Date.UTC(year, month, day)));
}

/** The first day (`YYYY-MM-01`) of the calendar month containing `date`. */
export function monthStartOf(date: string): string {
  const d = parseUtc(date);
  return formatUtc(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

/** The last day of the calendar month containing `date`. */
export function monthEndOf(date: string): string {
  const d = parseUtc(date);
  return formatUtc(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

export type RangeMode = "hari" | "minggu" | "bulan";

/**
 * The effective `{ from, to }` range for a range mode, anchored at
 * `referenceDate` (typically `today()`, or a shifted date for prev/next
 * navigation): today, its Sunday-start week, or its calendar month.
 */
export function rangeForMode(mode: RangeMode, referenceDate: string): { from: string; to: string } {
  switch (mode) {
    case "hari":
      return { from: referenceDate, to: referenceDate };
    case "minggu": {
      const from = sundayOf(referenceDate);
      return { from, to: addDays(from, 6) };
    }
    case "bulan":
      return { from: monthStartOf(referenceDate), to: monthEndOf(referenceDate) };
  }
}
