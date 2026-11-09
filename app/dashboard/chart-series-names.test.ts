import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Render every Bar as a marker carrying its `name`: Recharts shows that name in the tooltip,
// and falls back to the raw dataKey ("count") when it is missing.
vi.mock("recharts", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => createElement("div", null, children);
  const none = () => null;
  return {
    ResponsiveContainer: passthrough,
    BarChart: passthrough,
    Bar: ({ name, children }: { name?: string; children?: React.ReactNode }) =>
      createElement("i", { "data-bar-name": name ?? "" }, children),
    CartesianGrid: none,
    XAxis: none,
    YAxis: none,
    Tooltip: none,
    LabelList: none,
  };
});

import { MemberCharts } from "./statistik/member-charts";
import { ResultChart } from "./survei/[id]/result-chart";

const names = (html: string) => [...html.matchAll(/data-bar-name="([^"]*)"/g)].map((m) => m[1]);

describe("chart series names (shown in tooltips)", () => {
  it("member statistics bars are called Jumlah, not the raw key", () => {
    const stats = {
      total: 3,
      bySex: { MALE: 2, FEMALE: 1 },
      byMaritalStatus: { SINGLE: 3 },
      byWorkStatus: { WORKING: 3 },
      byAgeBracket: { DEWASA: 3 },
      byDirectSubGroup: [{ groupName: "Kelompok A", count: 3 }],
    };
    const found = names(renderToStaticMarkup(createElement(MemberCharts, { stats: stats as never })));
    expect(found.length).toBeGreaterThan(0);
    expect(new Set(found)).toEqual(new Set(["Jumlah"]));
  });

  it.each(["horizontal", "vertical"] as const)("survey %s result bars are called Jumlah", (orientation) => {
    const html = renderToStaticMarkup(
      createElement(ResultChart, { data: [{ label: "Ya", count: 2, percent: 100 }], orientation, ariaLabel: "x" }),
    );
    expect(names(html)).toEqual(["Jumlah"]);
  });
});
