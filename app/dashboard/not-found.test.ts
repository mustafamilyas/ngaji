import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import NotFound from "./not-found";

describe("dashboard NotFound", () => {
  it("makes the way back a 44px tap target below xl", () => {
    const html = renderToStaticMarkup(createElement(NotFound));
    expect(html).toMatch(/<a[^>]*class="[^"]*\bmin-h-11\b[^"]*"[^>]*>Kembali ke dasbor/);
  });
});
