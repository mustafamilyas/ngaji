import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return { ...actual, ResponsiveContainer: () => null };
});

import { ActivityAttendanceChart } from "./attendance-chart";

const summary = {
  occurrences: [
    { key: "2026-01-04", effectiveDate: "2026-01-04", hadir: 5, izin: 1, absent: 2, expected: 8, percentHadir: 63 },
    { key: "2026-01-11", effectiveDate: "2026-01-11", hadir: 0, izin: 0, absent: 8, expected: 8, percentHadir: 0 },
  ],
  totalExpected: 16,
  totalHadir: 5,
  totalIzin: 1,
  percentHadir: 31,
  participation: [],
};

const render = (canRecord: boolean) =>
  renderToStaticMarkup(
    createElement(ActivityAttendanceChart, {
      summary: summary as never,
      from: "2026-01-01",
      to: "2026-01-31",
      activityId: 3,
      canRecord,
    }),
  );

describe("ActivityAttendanceChart per-occurrence list on phones", () => {
  it("is one card per occurrence below md and a table from md", () => {
    const out = render(true);
    const section = out.slice(out.indexOf("Per occurrence"));
    expect(section).toMatch(/<table[^>]*class="[^"]*\bblock\b[^"]*\bmd:table\b/);
    expect(section).toMatch(/<thead[^>]*class="[^"]*hidden md:table-header-group/);
    expect(section).toMatch(/<tbody[^>]*class="[^"]*block md:table-row-group/);
  });

  it.each([[true], [false]])("the action link is 44px below xl (canRecord=%s)", (canRecord) => {
    const out = render(canRecord);
    const links = out.match(/<a [^>]*href="\/dashboard\/kegiatan\/3\/2026-01-\d\d"[^>]*>/g) ?? [];
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toContain("min-h-11");
      expect(link).toContain("text-base");
    }
  });

  it("labels each number on phones", () => {
    const out = render(true);
    for (const label of ["Hadir", "Izin", "Tidak hadir", "Expected", "% Hadir"]) {
      expect(out).toMatch(new RegExp(`<span[^>]*md:hidden[^>]*>${label}</span>`));
    }
  });
});
