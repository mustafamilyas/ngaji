import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SortSelect } from "./sort-select";

const options = [
  { key: "nama", label: "Nama" },
  { key: "grup", label: "Grup" },
];
const fallback = { key: "nama", dir: "asc" } as const;

function render(current: { key: string; dir: "asc" | "desc" }) {
  return renderToStaticMarkup(createElement(SortSelect, { options, current, fallback }));
}

describe("SortSelect", () => {
  it("is for phones only and has a 44px, 16px select", () => {
    const html = render(fallback);
    expect(html).toMatch(/^<div[^>]*class="[^"]*\bmd:hidden\b/);
    const select = html.match(/<select[^>]*>/)?.[0] ?? "";
    expect(select).toMatch(/aria-label="Urutkan"/);
    expect(select).toMatch(/class="[^"]*\bh-11\b[^"]*\btext-base\b/);
  });

  it("lists every column in both directions and selects the current one", () => {
    const html = render({ key: "grup", dir: "desc" });
    for (const value of ["nama:asc", "nama:desc", "grup:asc", "grup:desc"]) expect(html).toContain(`value="${value}"`);
    expect(html).toMatch(/<option[^>]*value="grup:desc"[^>]*selected|<option[^>]*selected[^>]*value="grup:desc"/);
  });

  it("carries the current order as hidden sort and dir fields, empty for the default order", () => {
    const current = render({ key: "grup", dir: "desc" });
    expect(current).toMatch(/<input[^>]*type="hidden"[^>]*name="sort"[^>]*value="grup"|<input[^>]*name="sort"[^>]*value="grup"/);
    expect(current).toMatch(/name="dir"[^>]*value="desc"/);
    const def = render(fallback);
    expect(def).toMatch(/name="sort"[^>]*value=""/);
    expect(def).toMatch(/name="dir"[^>]*value=""/);
  });
});
