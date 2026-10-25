import { describe, expect, it } from "vitest";
import { evaluate, formatReport, type Measurement } from "./findings";

const base: Measurement = {
  innerWidth: 360,
  scrollWidth: 360,
  items: [],
  charts: [],
};

const ctx = { page: "/dashboard/anggota", viewport: "360x740" };

describe("evaluate", () => {
  it("reports nothing for a clean page", () => {
    const m = { ...base, items: [{ tag: "a", type: "", label: "Anggota", w: 120, h: 44, fontSize: 14 }] };
    expect(evaluate(m, ctx)).toEqual([]);
  });

  it("reports horizontal overflow of the page", () => {
    const found = evaluate({ ...base, scrollWidth: 820 }, ctx);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: "overflow", ...ctx });
  });

  it("tolerates a 1px rounding difference in scroll width", () => {
    expect(evaluate({ ...base, scrollWidth: 361 }, ctx)).toEqual([]);
  });

  it("reports a tap target shorter than 44px, but not a narrow one", () => {
    const m = {
      ...base,
      items: [
        { tag: "button", type: "button", label: "Hadir", w: 56, h: 32, fontSize: 14 },
        { tag: "a", type: "", label: "Izin", w: 38, h: 44, fontSize: 14 },
      ],
    };
    const found = evaluate(m, ctx);
    expect(found.map((f) => f.kind)).toEqual(["target-size"]);
    expect(found[0].detail).toContain("Hadir");
    expect(found[0].detail).toContain("56x32");
  });

  it("accepts 43.6px, which is 44px after sub-pixel rounding", () => {
    const m = { ...base, items: [{ tag: "a", type: "", label: "x", w: 100, h: 43.6, fontSize: 14 }] };
    expect(evaluate(m, ctx)).toEqual([]);
  });

  it("reports text fields under 16px (iOS zooms on focus) but not buttons or checkboxes", () => {
    const m = {
      ...base,
      items: [
        { tag: "input", type: "text", label: "Nama", w: 296, h: 44, fontSize: 14 },
        { tag: "select", type: "", label: "Status", w: 296, h: 44, fontSize: 15 },
        { tag: "button", type: "submit", label: "Simpan", w: 296, h: 44, fontSize: 14 },
        { tag: "input", type: "checkbox", label: "Senin", w: 296, h: 44, fontSize: 12 },
        { tag: "input", type: "text", label: "Ok", w: 296, h: 44, fontSize: 16 },
      ],
    };
    const found = evaluate(m, ctx);
    expect(found.map((f) => f.kind)).toEqual(["text-size", "text-size"]);
    expect(found.map((f) => f.detail).join(" ")).toContain("Nama");
    expect(found.map((f) => f.detail).join(" ")).toContain("Status");
  });

  it("reports a chart whose svg did not follow its container", () => {
    const m = { ...base, charts: [{ container: 328, svg: 721 }, { container: 328, svg: 327 }] };
    const found = evaluate(m, ctx);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: "chart-width" });
    expect(found[0].detail).toContain("721");
  });

  it("collapses identical findings from repeated elements", () => {
    const item = { tag: "button", type: "button", label: "Hadir", w: 56, h: 32, fontSize: 14 };
    expect(evaluate({ ...base, items: [item, item, item] }, ctx)).toHaveLength(1);
  });
});

describe("formatReport", () => {
  it("says so when there is nothing to report", () => {
    expect(formatReport([], [])).toContain("No defects");
  });

  it("lists defects grouped by page and notes skipped pages", () => {
    const text = formatReport(
      [{ kind: "target-size", page: "/dashboard/pengguna", viewport: "360x740", detail: "Kelola 60x32" }],
      [{ page: "/dashboard/audit", reason: "HTTP 404" }],
    );
    expect(text).toContain("/dashboard/pengguna");
    expect(text).toContain("target-size");
    expect(text).toContain("Kelola 60x32");
    expect(text).toContain("Skipped");
    expect(text).toContain("HTTP 404");
  });
});
