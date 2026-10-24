import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TabNav } from "./tab-nav";

describe("TabNav", () => {
  it("makes every tab link at least 44px tall below xl", () => {
    const html = renderToStaticMarkup(
      createElement(TabNav, {
        path: "/dashboard/survei/1",
        current: "hasil",
        defaultTab: "hasil",
        tabs: [
          { key: "hasil", label: "Hasil" },
          { key: "formulir", label: "Formulir" },
        ],
      }),
    );
    const links = html.match(/<a\b[^>]*>/g) ?? [];
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toMatch(/class="[^"]*\bh-11\b[^"]*\bxl:h-10\b/);
  });
});
