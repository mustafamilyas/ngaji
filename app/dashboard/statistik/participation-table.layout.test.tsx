import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PAGE_SIZE } from "@/lib/constants";
import { DEFAULT_PARTICIPATION_SORT, MEMBER_SORT_PARAMS } from "@/lib/sort";
import { participationPage } from "@/lib/participation/page";
import type { ParticipationRow } from "@/lib/stats";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { ParticipationTable } from "./participation-table";

const rows: ParticipationRow[] = [
  { memberId: 7, memberName: "Budi", occurrenceCount: 8, hadir: 6, izin: 1, percentHadir: 75 },
  { memberId: 8, memberName: "Siti", occurrenceCount: 8, hadir: 8, izin: 0, percentHadir: 100 },
];

const base = "/dashboard/statistik";

function html(
  over: { all?: ParticipationRow[]; page?: number; sort?: typeof DEFAULT_PARTICIPATION_SORT; searchParams?: Record<string, string> } = {},
) {
  const sort = over.sort ?? DEFAULT_PARTICIPATION_SORT;
  return renderToStaticMarkup(
    <ParticipationTable
      page={participationPage(over.all ?? rows, { sort, page: over.page ?? 1 })}
      sort={sort}
      basePath={base}
      searchParams={{ tab: "partisipasi", ...over.searchParams }}
    />,
  );
}

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
    const sortLinks = out.match(/<a [^>]*href="[^"]*(?:\?|&amp;)sort=[^"]*"[^>]*>/g) ?? [];
    expect(sortLinks.length).toBeGreaterThanOrEqual(4);
    for (const a of sortLinks) expect(a).toContain("min-h-11");
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

describe("ParticipationTable server paging", () => {
  const many = Array.from({ length: 300 }, (_, i) => ({
    memberId: i + 1,
    memberName: `Anggota ${String(i + 1).padStart(3, "0")}`,
    occurrenceCount: 10,
    hadir: i % 11,
    izin: 0,
    percentHadir: (i % 11) * 10,
  }));

  it("renders only one page of rows and a pager for all of them", () => {
    const out = html({ all: many });
    expect(out.match(/href="\/dashboard\/anggota\/\d+"/g)).toHaveLength(PAGE_SIZE);
    expect(out).toContain(`1–${PAGE_SIZE} dari 300`);
    expect(out).toContain('href="/dashboard/statistik?tab=partisipasi&amp;page=2"');
  });

  it("sort links keep the other params, drop the page and flip the active column", () => {
    const out = html({ all: many, page: 3, searchParams: { q: "ani", range: "30h" } });
    expect(out).toContain('href="/dashboard/statistik?tab=partisipasi&amp;q=ani&amp;range=30h"');
    expect(out).toContain('href="/dashboard/statistik?tab=partisipasi&amp;q=ani&amp;range=30h&amp;sort=nama&amp;dir=asc"');
    expect(out).toContain('aria-sort="descending"');
  });

  it("uses its own param names when given, so a second table on the page keeps its order", () => {
    const sort = DEFAULT_PARTICIPATION_SORT;
    const out = renderToStaticMarkup(
      <ParticipationTable
        page={participationPage(many, { sort, page: 1, pageSize: 10 })}
        sort={sort}
        basePath="/dashboard/kegiatan/3"
        searchParams={{ ksort: "hadir", kdir: "desc", peserta: "2" }}
        params={MEMBER_SORT_PARAMS}
        selectLabel="Urutkan peserta"
      />,
    );
    expect(out).toContain('href="/dashboard/kegiatan/3?ksort=hadir&amp;kdir=desc&amp;psort=nama&amp;pdir=asc"');
    expect(out).toContain("peserta=2");
    expect(out).toContain('aria-label="Urutkan peserta"');
    expect(out.match(/href="\/dashboard\/anggota\/\d+"/g)).toHaveLength(10);
  });

  it("shows the empty state when no member matches", () => {
    expect(html({ all: [] })).toContain("Tidak ada anggota dalam scope ini.");
  });
});
