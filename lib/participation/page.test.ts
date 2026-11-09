import { describe, expect, it } from "vitest";
import { PAGE_SIZE } from "@/lib/constants";
import type { ParticipationRow } from "@/lib/stats";
import { participationPage } from "./page";

function row(id: number, name: string, percentHadir: number): ParticipationRow {
  return { memberId: id, memberName: name, occurrenceCount: 10, hadir: Math.round(percentHadir / 10), izin: 0, percentHadir };
}

const many = Array.from({ length: 300 }, (_, i) => row(i + 1, `Anggota ${String(i + 1).padStart(3, "0")}`, i % 101));

describe("participationPage", () => {
  it("sends only one page of a long list and reports the full total", () => {
    const page = participationPage(many, { sort: { key: "nama", dir: "asc" }, page: 1 });
    expect(page.items).toHaveLength(PAGE_SIZE);
    expect(page.total).toBe(300);
    expect(page.pageSize).toBe(PAGE_SIZE);
  });

  it("continues the global order on page 2, not the order within page 1", () => {
    const sort = { key: "persen", dir: "desc" } as const;
    const first = participationPage(many, { sort, page: 1 });
    const second = participationPage(many, { sort, page: 2 });
    const all = [...first.items, ...second.items].map((r) => r.percentHadir);
    expect(all).toEqual([...all].sort((a, b) => b - a));
    expect(second.items[0].percentHadir).toBeLessThanOrEqual(first.items[first.items.length - 1].percentHadir);
  });

  it("clamps a page past the end to the last page", () => {
    const page = participationPage(many, { sort: { key: "nama", dir: "asc" }, page: 99 });
    expect(page.page).toBe(Math.ceil(300 / PAGE_SIZE));
    expect(page.items.length).toBeGreaterThan(0);
  });

  it("searches by name before paginating, ignoring case", () => {
    const page = participationPage(many, { sort: { key: "nama", dir: "asc" }, page: 1, q: "anggota 29" });
    expect(page.total).toBe(10);
    expect(page.items.every((r) => r.memberName.startsWith("Anggota 29"))).toBe(true);
  });

  it("returns an empty first page when nothing matches", () => {
    const page = participationPage(many, { sort: { key: "nama", dir: "asc" }, page: 3, q: "zzz" });
    expect(page).toMatchObject({ items: [], page: 1, total: 0 });
  });
});
