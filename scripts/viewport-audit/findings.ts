/** Pure rules of the viewport audit: turn what the page reported into a list of defects. */

/** Minimum tap-target height in CSS px; 43.5 absorbs sub-pixel rounding of a 44px box. */
export const MIN_TARGET_PX = 43.5;
/** Text fields below this size make iOS Safari zoom the page on focus. */
export const MIN_FIELD_FONT_PX = 16;
/** Read-only dashboard text below `xl` is at least this size (mobile-list-layout spec). */
export const MIN_READ_FONT_PX = 14;
/** On a list page at phone size, the first record starts no lower than this (document y, filter panel closed). */
export const MAX_FIRST_RECORD_PX = 600;
/** Tailwind's `xl`: from here 12px `text-xs` is allowed again. */
const XL_PX = 1280;
/** Allowed gap between a chart container and its svg (rounding). */
const CHART_TOLERANCE_PX = 2;
const OVERFLOW_TOLERANCE_PX = 1;

export type MeasuredItem = {
  tag: string;
  type: string;
  label: string;
  w: number;
  h: number;
  fontSize: number;
};

export type Measurement = {
  innerWidth: number;
  scrollWidth: number;
  items: MeasuredItem[];
  charts: { container: number; svg: number }[];
  /** The page is inside the dashboard layout (`[data-dashboard]`); the landing pages keep their own sizes. */
  dashboard: boolean;
  /** Visible text, one entry per distinct element and size; svg, `.sr-only` and `[data-small-text-ok]` are left out. */
  texts: { label: string; fontSize: number }[];
  /** Document y of the first row of `[data-records]`, or null when the page has none. */
  firstRecordTop: number | null;
};

export type FindingKind = "overflow" | "target-size" | "text-size" | "read-text-size" | "first-record" | "chart-width" | "flow";

export type Finding = { kind: FindingKind; page: string; viewport: string; detail: string };
export type SkippedPage = { page: string; reason: string };

const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "image"]);

const isTextField = (item: MeasuredItem) =>
  item.tag === "select" || item.tag === "textarea" || (item.tag === "input" && !NON_TEXT_INPUTS.has(item.type));

const size = (item: MeasuredItem) => `${Math.round(item.w)}x${Math.round(item.h)}`;

export function evaluate(
  measurement: Measurement,
  { checkFirstRecord = false, ...context }: { page: string; viewport: string; checkFirstRecord?: boolean },
): Finding[] {
  const found: Finding[] = [];
  const add = (kind: FindingKind, detail: string) => found.push({ kind, ...context, detail });

  if (measurement.scrollWidth > measurement.innerWidth + OVERFLOW_TOLERANCE_PX) {
    add("overflow", `page is ${measurement.scrollWidth}px wide in a ${measurement.innerWidth}px viewport`);
  }

  for (const item of measurement.items) {
    if (item.h < MIN_TARGET_PX) add("target-size", `${item.label || item.tag} ${size(item)} (needs 44px tall)`);
    if (isTextField(item) && item.fontSize < MIN_FIELD_FONT_PX) {
      add("text-size", `${item.label || item.tag} has ${item.fontSize}px text (needs ${MIN_FIELD_FONT_PX}px)`);
    }
  }

  if (measurement.dashboard && measurement.innerWidth < XL_PX) {
    for (const text of measurement.texts) {
      if (text.fontSize < MIN_READ_FONT_PX) add("read-text-size", `${text.label} is ${text.fontSize}px (needs ${MIN_READ_FONT_PX}px)`);
    }
  }

  if (checkFirstRecord) {
    const top = measurement.firstRecordTop;
    if (top === null) add("first-record", "no [data-records] row found");
    else if (top > MAX_FIRST_RECORD_PX) add("first-record", `first record starts at ${top}px (needs ${MAX_FIRST_RECORD_PX}px or less)`);
  }

  for (const chart of measurement.charts) {
    if (Math.abs(chart.container - chart.svg) > CHART_TOLERANCE_PX) {
      add("chart-width", `chart svg is ${chart.svg}px in a ${chart.container}px container`);
    }
  }

  // Repeated rows report the same control many times; one line is enough.
  const seen = new Set<string>();
  return found.filter((f) => {
    const key = `${f.kind}|${f.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatReport(findings: Finding[], skipped: SkippedPage[]): string {
  const lines: string[] = [];
  if (findings.length === 0) {
    lines.push("No defects found.");
  } else {
    const byPage = new Map<string, Finding[]>();
    for (const f of findings) byPage.set(f.page, [...(byPage.get(f.page) ?? []), f]);
    lines.push(`${findings.length} defect(s) on ${byPage.size} page(s):`, "");
    for (const [page, list] of byPage) {
      lines.push(page);
      for (const f of list) lines.push(`  ${f.viewport.padEnd(9)} ${f.kind.padEnd(14)} ${f.detail}`);
    }
  }
  if (skipped.length > 0) {
    lines.push("", "Skipped (not measured):");
    for (const s of skipped) lines.push(`  ${s.page}  ${s.reason}`);
  }
  return lines.join("\n");
}
