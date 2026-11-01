// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, within } from "@/lib/test/dom";
import { EMBEDDED_PAGE_SIZE } from "@/lib/constants";
import { tagChoices } from "@/lib/tag/choices";
import type { AttendanceBreakdown } from "@/lib/summary/breakdown";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { BreakdownSection } from "./breakdown-section";

const tag = (id: number, key: string, value: string | null = null) => ({ id, groupId: 3, key, value, color: "blue" });
const choices = tagChoices([
  { group: { id: 3, name: "Kelompok Melati", isOwn: true }, tags: [tag(1, "fokus"), tag(2, "prioritas", "tinggi"), tag(3, "prioritas", "rendah")] },
]);

const row = (i: number) => ({ key: `r${i}`, label: `Baris ${i}`, expected: 10, hadir: 6, izin: 1, absent: 3, percentHadir: 60 });
const breakdown = (n: number): AttendanceBreakdown => ({ label: "Jenis kelamin", rows: Array.from({ length: n }, (_, i) => row(i + 1)) });

function setup(props: Partial<React.ComponentProps<typeof BreakdownSection>> = {}) {
  return render(
    <BreakdownSection
      choices={choices}
      breakdown={null}
      selected={undefined}
      basePath="/dashboard/statistik"
      searchParams={{ tab: "kegiatan", grup: "3", rincianhal: "2" }}
      page={1}
      {...props}
    />,
  );
}

describe("BreakdownSection (task 6.2)", () => {
  beforeEach(() => {
    push.mockClear();
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("offers the picker without a table when nothing is chosen", () => {
    setup();
    expect(screen.getByRole("button", { name: /Rincian menurut/ })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("lists none, the fixed dimensions and one entry per tag key, and navigates keeping params but not the page", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Rincian menurut/ }));
    for (const name of ["Jenis kelamin", "Kelompok umur", "Status pernikahan", "Status pekerjaan", "fokus", "prioritas"]) {
      expect(screen.getByRole("option", { name: new RegExp(name) })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("option", { name: /Status pekerjaan/ }));
    expect(push).toHaveBeenCalledWith("/dashboard/statistik?tab=kegiatan&grup=3&rincian=work", { scroll: false });
  });

  it("encodes a tag choice as tag:<id> and clears with the X", async () => {
    setup({ selected: "tag:2", breakdown: breakdown(2) });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Hapus rincian" }));
    expect(push).toHaveBeenCalledWith("/dashboard/statistik?tab=kegiatan&grup=3", { scroll: false });
    await user.click(screen.getByRole("button", { name: /Rincian menurut/ }));
    await user.click(screen.getByRole("option", { name: /^fokus/ }));
    expect(push).toHaveBeenLastCalledWith("/dashboard/statistik?tab=kegiatan&grup=3&rincian=tag%3A1", { scroll: false });
  });

  it("shows every column with the as-of-today hint", () => {
    setup({ selected: "sex", breakdown: breakdown(2) });
    const table = screen.getByRole("table");
    for (const name of ["Expected", "Hadir", "Izin", "Tidak hadir", "% hadir"]) {
      expect(within(table).getByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(screen.getByText("Berdasarkan data anggota saat ini.")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Baris 1/ })).getByText("60%")).toBeInTheDocument();
  });

  it("pages the rows beyond EMBEDDED_PAGE_SIZE with its own param", () => {
    setup({ selected: "tag:2", breakdown: breakdown(EMBEDDED_PAGE_SIZE + 3), page: 2 });
    expect(screen.getAllByRole("row")).toHaveLength(1 + 3);
    const prev = screen.getByRole("link", { name: /Halaman sebelumnya/ });
    expect(prev.getAttribute("href")).toBe("/dashboard/statistik?tab=kegiatan&grup=3");
  });

  it("says so when the breakdown has no rows", () => {
    setup({ selected: "sex", breakdown: breakdown(0) });
    expect(screen.getByText("Tidak ada anggota yang diharapkan pada rentang ini.")).toBeInTheDocument();
  });
});
