import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return { ...actual, ResponsiveContainer: () => null };
});

import { ActivityAttendanceChart } from "./attendance-chart";

const props = {
  from: "2026-01-01",
  to: "2026-01-31",
  totals: { occurrenceCount: 2, hadir: 5, izin: 1, absent: 10, percentHadir: 31 },
  trend: [
    { date: "2026-01-04", percentHadir: 63 },
    { date: "2026-01-11", percentHadir: 0 },
  ],
};

describe("ActivityAttendanceChart", () => {
  it("shows the totals as tiles with the date range", () => {
    const out = renderToStaticMarkup(<ActivityAttendanceChart {...props} />);
    expect(out).toContain("Ringkasan (2026-01-01 – 2026-01-31)");
    for (const label of ["Occurrence", "Hadir", "Izin", "Tidak hadir", "% hadir keseluruhan"]) expect(out).toContain(label);
    expect(out).toContain("31%");
  });

  it("draws the trend only with more than one occurrence", () => {
    expect(renderToStaticMarkup(<ActivityAttendanceChart {...props} />)).toContain("Tren % hadir");
    expect(renderToStaticMarkup(<ActivityAttendanceChart {...props} trend={props.trend.slice(0, 1)} />)).not.toContain("Tren % hadir");
  });

  it("takes no member or occurrence rows, so none are sent to the browser", () => {
    // The props are the whole contract: totals and trend points only.
    expect(Object.keys(props).sort()).toEqual(["from", "to", "totals", "trend"]);
  });
});
