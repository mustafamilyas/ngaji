import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Pagination } from "./pagination";

describe("Pagination touch sizes", () => {
  const html = renderToStaticMarkup(
    createElement(Pagination, { page: 2, pageSize: 10, total: 50, hrefFor: (page) => `?p=${page}` }),
  );

  it("previous and next links are 44px below xl and compact from xl", () => {
    for (const label of ["Halaman sebelumnya", "Halaman berikutnya"]) {
      const tag = html.match(new RegExp(`<a [^>]*aria-label="${label}"[^>]*>`))?.[0] ?? "";
      expect(tag).toContain("h-11");
      expect(tag).toContain("min-w-11");
      expect(tag).toContain("xl:h-8");
    }
  });
});
