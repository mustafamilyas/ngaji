import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DialogFooter } from "./dialog";

describe("DialogFooter", () => {
  const html = renderToStaticMarkup(createElement(DialogFooter, null, "Tombol"));

  it("sticks to the bottom of the scrolling dialog so Simpan and Tutup stay reachable on short screens", () => {
    expect(html).toMatch(/class="[^"]*\bsticky\b/);
    expect(html).toMatch(/class="[^"]*\s-bottom-5\s/);
  });

  it("has its own background and a top border so scrolled fields do not show through", () => {
    expect(html).toMatch(/class="[^"]*\bbg-popover\b/);
    expect(html).toMatch(/class="[^"]*\bborder-t\b/);
  });

  it("extends over the dialog padding so the bar spans the full width", () => {
    expect(html).toMatch(/class="[^"]*\s-mx-5\s/);
    expect(html).toMatch(/class="[^"]*\s-mb-5\s/);
  });

  it("right-aligns the buttons and renders its children", () => {
    expect(html).toMatch(/class="[^"]*\bjustify-end\b/);
    expect(html).toContain("Tombol");
  });
});
