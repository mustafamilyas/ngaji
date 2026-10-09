import { describe, expect, it } from "vitest";
import { clampPage, pageHref, pageWindow, paginate } from "./pagination";

describe("clampPage", () => {
  it("keeps a page that exists", () => {
    expect(clampPage(2, 120, 50)).toBe(2);
  });

  it("moves a page past the end back to the last page", () => {
    expect(clampPage(9, 120, 50)).toBe(3);
  });

  it("is page 1 for an empty list", () => {
    expect(clampPage(4, 0, 50)).toBe(1);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1);

  it("slices the requested page and reports totals", () => {
    expect(paginate(items, 2, 10)).toEqual({
      items: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      page: 2,
      pageSize: 10,
      total: 23,
    });
  });

  it("returns the short last page", () => {
    expect(paginate(items, 3, 10).items).toEqual([21, 22, 23]);
  });

  it("clamps an out-of-range page", () => {
    expect(paginate(items, 99, 10)).toMatchObject({ page: 3, items: [21, 22, 23] });
  });
});

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps first, last and the neighbours of the current page, with gaps", () => {
    expect(pageWindow(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
  });

  it("does not leave a gap that would hide a single page", () => {
    expect(pageWindow(4, 12)).toEqual([1, 2, 3, 4, 5, "gap", 12]);
    expect(pageWindow(9, 12)).toEqual([1, "gap", 8, 9, 10, 11, 12]);
  });

  it("handles the ends", () => {
    expect(pageWindow(1, 12)).toEqual([1, 2, "gap", 12]);
    expect(pageWindow(12, 12)).toEqual([1, "gap", 11, 12]);
  });
});

describe("pageHref", () => {
  it("keeps the other params and sets the page", () => {
    expect(pageHref("/anggota", { q: "budi", grup: "3,4", page: "1" }, 3)).toBe("/anggota?q=budi&grup=3%2C4&page=3");
  });

  it("drops the param for page 1", () => {
    expect(pageHref("/anggota", { q: "budi", page: "4" }, 1)).toBe("/anggota?q=budi");
    expect(pageHref("/anggota", {}, 1)).toBe("/anggota");
  });

  it("supports a custom page param and repeated values", () => {
    expect(pageHref("/kegiatan/1", { range: "7h", tag: ["a", "b"] }, 2, "jadwal")).toBe(
      "/kegiatan/1?range=7h&tag=a&tag=b&jadwal=2",
    );
  });
});
