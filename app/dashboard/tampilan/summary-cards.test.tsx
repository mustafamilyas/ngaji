// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/lib/test/dom";
import type { SummaryCard } from "@/lib/member-view/summaries";
import { SummaryCards } from "./summary-cards";

const sexDimension = { kind: "property", field: "sex" } as const;

function card(overrides: Partial<SummaryCard> = {}): SummaryCard {
  return {
    index: 0,
    dimension: sexDimension,
    title: "Jenis kelamin",
    total: 4,
    bucketCount: 2,
    chart: [
      { key: "p:L", label: "Laki-laki", count: 3, percent: 75 },
      { key: "p:P", label: "Perempuan", count: 1, percent: 25 },
    ],
    table: null,
    ...overrides,
  };
}

const view = (cards: SummaryCard[], searchParams: Record<string, string> = {}) =>
  render(<SummaryCards cards={cards} basePath="/dashboard/tampilan/5" searchParams={searchParams} />);

describe("SummaryCards (task 4.3)", () => {
  it("renders nothing without cards", () => {
    const { container } = view([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows title, population total and every bucket as text with count and percent", () => {
    view([card()]);
    expect(screen.getByRole("heading", { name: "Jenis kelamin" })).toBeInTheDocument();
    expect(screen.getByText("4 anggota")).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Laki-laki/ });
    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByText("75%")).toBeInTheDocument();
  });

  it("hides the decorative chart from assistive technology", () => {
    view([card()]);
    expect(screen.getByTestId("summary-chart")).toHaveAttribute("aria-hidden", "true");
  });

  it("explains a level above the viewer and an empty population instead of a chart", () => {
    view([card({ index: 0, levelInvalid: true, bucketCount: 0, chart: [], title: "Cabang" }), card({ index: 1, total: 0, bucketCount: 0, chart: [] })]);
    expect(screen.getByText("Tingkat grup ini tidak berlaku untuk akun Anda.")).toBeInTheDocument();
    expect(screen.getByText("Tidak ada data.")).toBeInTheDocument();
    expect(screen.queryByTestId("summary-chart")).not.toBeInTheDocument();
  });

  it("pages a long bucket table with the card's own param, keeping the other params", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ key: `g:${i}`, label: `Kelompok ${i}`, count: i + 1, percent: 1 }));
    view(
      [card({ index: 1, bucketCount: 25, chart: items.slice(0, 5), table: { items, page: 2, pageSize: 10, total: 25 } })],
      { page: "3", ringkasan0: "4" },
    );
    expect(screen.getAllByRole("row")).toHaveLength(1 + 10);
    const next = screen.getByRole("link", { name: /berikut/i });
    const href = next.getAttribute("href")!;
    expect(href).toContain("ringkasan1=3");
    expect(href).toContain("page=3");
    expect(href).toContain("ringkasan0=4");
  });
});
