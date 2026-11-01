import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EMBEDDED_PAGE_SIZE } from "@/lib/constants";
import { paginate } from "@/lib/pagination";
import { DEFAULT_OCCURRENCE_SORT, OCCURRENCE_SORT_PARAMS, sortOccurrences } from "@/lib/sort";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { OccurrenceTable } from "./occurrence-table";

const occurrence = (day: number, hadir = 5) => {
  const date = `2026-01-${String(day).padStart(2, "0")}`;
  return { key: date, effectiveDate: date, hadir, izin: 1, absent: 2, expected: 8, percentHadir: 63 };
};

function render({
  all = [occurrence(4), occurrence(11, 0)],
  page = 1,
  canRecord = true,
  searchParams = {},
  sort = DEFAULT_OCCURRENCE_SORT,
}: {
  all?: ReturnType<typeof occurrence>[];
  page?: number;
  canRecord?: boolean;
  searchParams?: Record<string, string>;
  sort?: typeof DEFAULT_OCCURRENCE_SORT;
} = {}) {
  return renderToStaticMarkup(
    <OccurrenceTable
      page={paginate(sortOccurrences(all, sort), page, EMBEDDED_PAGE_SIZE)}
      sort={sort}
      activityId={3}
      canRecord={canRecord}
      basePath="/dashboard/kegiatan/3"
      searchParams={searchParams}
    />,
  );
}

describe("OccurrenceTable on phones and tablets", () => {
  it("is one card per occurrence below md and a table from md", () => {
    const out = render();
    expect(out).toMatch(/<table[^>]*class="[^"]*\bblock\b[^"]*\bmd:table\b/);
    expect(out).toMatch(/<thead[^>]*class="[^"]*hidden md:table-header-group/);
    expect(out).toMatch(/<tbody[^>]*class="[^"]*block md:table-row-group/);
  });

  it.each([[true], [false]])("the action link is 44px below xl (canRecord=%s)", (canRecord) => {
    const links = render({ canRecord }).match(/<a [^>]*href="\/dashboard\/kegiatan\/3\/2026-01-\d\d"[^>]*>/g) ?? [];
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toContain("min-h-11");
      expect(link).toContain("text-base");
    }
  });

  it("labels each number on phones", () => {
    const out = render();
    for (const label of ["Hadir", "Izin", "Tidak hadir", "Expected", "% Hadir"]) {
      expect(out).toMatch(new RegExp(`<span[^>]*md:hidden[^>]*>${label}</span>`));
    }
  });

  it("has a phone-only sort select with 44px height and 16px text", () => {
    const out = render();
    const select = out.match(/<select[^>]*aria-label="Urutkan kejadian"[^>]*>/)?.[0] ?? "";
    expect(select).toContain("h-11");
    expect(select).toContain("text-base");
    expect(out).toContain("Tanggal (turun)");
    expect(out).toContain("Tidak hadir (naik)");
  });
});

describe("OccurrenceTable server paging and sorting", () => {
  const all = Array.from({ length: 25 }, (_, i) => occurrence(i + 1, i));

  it("renders only one page of rows with a pager under its own page param", () => {
    const out = render({ all, searchParams: { tab: "absensi", peserta: "2", psort: "nama" } });
    expect(out.match(/href="\/dashboard\/kegiatan\/3\/2026-01-\d\d"/g)).toHaveLength(EMBEDDED_PAGE_SIZE);
    expect(out).toContain(`1–${EMBEDDED_PAGE_SIZE} dari 25`);
    expect(out).toContain(`${OCCURRENCE_SORT_PARAMS.page}=2`);
    // The other table's page and order are kept.
    expect(out).toContain("peserta=2");
    expect(out).toContain("psort=nama");
  });

  it("sort links use the occurrence params, drop its page and keep the other table's params", () => {
    const out = render({ all, page: 2, searchParams: { kejadian: "2", peserta: "3" } });
    expect(out).toContain('href="/dashboard/kegiatan/3?peserta=3&amp;ksort=hadir&amp;kdir=desc"');
    expect(out).not.toContain("kejadian=2");
    expect(out).toContain('aria-sort="descending"');
  });

  it("continues the global order on page 2", () => {
    const out = render({ all, page: 2, sort: { key: "hadir", dir: "desc" } });
    // hadir is 24..0 across 25 rows; page 2 starts at hadir 14 = day 15.
    expect(out.match(/href="\/dashboard\/kegiatan\/3\/(2026-01-\d\d)"/)?.[1]).toBe("2026-01-15");
  });

  it("shows the empty state without occurrences", () => {
    expect(render({ all: [] })).toContain("Belum ada riwayat absensi pada rentang ini.");
  });
});
