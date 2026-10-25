import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ParticipationTable } from "./participation-table";

const rows = [
  { memberId: 7, memberName: "Budi", occurrenceCount: 8, hadir: 6, izin: 1, percentHadir: 75 },
  { memberId: 8, memberName: "Siti", occurrenceCount: 8, hadir: 8, izin: 0, percentHadir: 100 },
];

const html = () => renderToStaticMarkup(createElement(ParticipationTable, { rows }));

describe("ParticipationTable phone and tablet layout", () => {
  it("is one card per member below md and a table from md", () => {
    const out = html();
    expect(out).toMatch(/<table[^>]*class="[^"]*\bblock\b[^"]*\bmd:table\b/);
    expect(out).toMatch(/<thead[^>]*class="[^"]*hidden md:table-header-group/);
    expect(out).toMatch(/<tbody[^>]*class="[^"]*block md:table-row-group/);
    expect(out).toMatch(/<tr[^>]*class="[^"]*grid[^"]*md:table-row/);
  });

  it("labels each number on phones", () => {
    const out = html();
    for (const label of ["Occurrence", "Hadir", "Izin", "% Hadir"]) {
      expect(out).toMatch(new RegExp(`<span[^>]*md:hidden[^>]*>${label}</span>`));
    }
  });

  it("member links and sort headers are 44px below xl", () => {
    const out = html();
    const link = out.match(/<a [^>]*href="\/dashboard\/anggota\/7"[^>]*>/)?.[0] ?? "";
    expect(link).toContain("min-h-11");
    const sortButtons = out.match(/<button[^>]*type="button"[^>]*>/g) ?? [];
    expect(sortButtons).toHaveLength(5);
    for (const button of sortButtons) expect(button).toContain("min-h-11");
  });

  it("has a phone-only sort select with 44px height and 16px text", () => {
    const out = html();
    const wrapper = out.match(/<div[^>]*md:hidden[^>]*>\s*<select/)?.[0] ?? "";
    expect(wrapper).not.toBe("");
    const select = out.match(/<select[^>]*aria-label="Urutkan"[^>]*>/)?.[0] ?? "";
    expect(select).toContain("h-11");
    expect(select).toContain("text-base");
    expect(out).toContain("% Hadir (turun)");
    expect(out).toContain("Nama (naik)");
  });
});
