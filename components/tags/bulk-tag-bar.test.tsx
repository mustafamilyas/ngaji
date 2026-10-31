// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/lib/test/dom";
import type { TagOwnerGroup } from "@/lib/tag/list";

const actions = vi.hoisted(() => ({
  attachTagAction: vi.fn(),
  detachTagAction: vi.fn(),
  createAndAttachTagAction: vi.fn(),
  bulkTagMembersAction: vi.fn(),
}));
vi.mock("@/app/dashboard/tag/actions", () => actions);

import { BulkSelectionProvider, RowCheckbox, SelectAllRow } from "./bulk-selection";
import { BulkTagBar } from "./bulk-tag-bar";
import { TagOptionsProvider } from "./tag-options-context";

const tag = (id: number, key: string, value: string | null = null) => ({ id, groupId: 3, key, value, color: "blue" });

const options: TagOwnerGroup[] = [
  { group: { id: 3, name: "Kelompok Melati", isOwn: true }, tags: [tag(1, "fokus"), tag(2, "prioritas", "tinggi"), tag(3, "prioritas", "rendah")] },
];

const members = [
  { id: 10, name: "Ahmad" },
  { id: 11, name: "Budi" },
  { id: 12, name: "Citra" },
];
const memberTags = { 10: [tag(2, "prioritas", "tinggi")], 11: [tag(1, "fokus")], 12: [] };

function Page({ resetKey = "a" }: { resetKey?: string }) {
  return (
    <TagOptionsProvider options={options} canCreate={false}>
      <BulkSelectionProvider key={resetKey} memberIds={members.map((m) => m.id)} memberTags={memberTags}>
        <SelectAllRow />
        {members.map((m) => (
          <RowCheckbox key={m.id} memberId={m.id} name={m.name} />
        ))}
        <BulkTagBar />
      </BulkSelectionProvider>
    </TagOptionsProvider>
  );
}

function stubBrowser(wide: boolean) {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: wide, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
}

describe("bulk tagging on the member table (task 5.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowser(true);
    actions.bulkTagMembersAction.mockResolvedValue({ ok: true, data: { changed: 2 } });
  });

  it("shows no action bar until a row is selected", () => {
    render(<Page />);
    expect(screen.queryByRole("button", { name: "Tambah tag" })).not.toBeInTheDocument();
  });

  it("keeps one live region mounted from the start, so the first selection is announced (task 7.5)", async () => {
    render(<Page />);
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    await userEvent.setup().click(screen.getByRole("checkbox", { name: "Pilih Ahmad" }));
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("1 anggota dipilih");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("announces how many members are selected", async () => {
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Pilih Ahmad" }));
    await user.click(screen.getByRole("checkbox", { name: "Pilih Budi" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 anggota dipilih");
  });

  it("selects and clears the whole page from the select-all row", async () => {
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: /Pilih semua/ }));
    expect(screen.getByRole("status")).toHaveTextContent("3 anggota dipilih");
    await user.click(screen.getByRole("checkbox", { name: /Pilih semua/ }));
    expect(screen.queryByRole("button", { name: "Tambah tag" })).not.toBeInTheDocument();
  });

  it("clears the selection when the page's members change", async () => {
    const { rerender } = render(<Page resetKey="page-1" />);
    await userEvent.setup().click(screen.getByRole("checkbox", { name: "Pilih Ahmad" }));
    expect(screen.getByRole("button", { name: "Tambah tag" })).toBeInTheDocument();
    rerender(<Page resetKey="page-2" />);
    expect(screen.queryByRole("button", { name: "Tambah tag" })).not.toBeInTheDocument();
  });

  it("adds a tag only after the user confirms", async () => {
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Pilih Ahmad" }));
    await user.click(screen.getByRole("checkbox", { name: "Pilih Budi" }));
    await user.click(screen.getByRole("button", { name: "Tambah tag" }));
    await user.click(screen.getByRole("option", { name: /fokus/ }));

    expect(actions.bulkTagMembersAction).not.toHaveBeenCalled();
    expect(screen.getByText(/Tambah.*fokus.*2 anggota/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(actions.bulkTagMembersAction).toHaveBeenCalledWith({ memberIds: [10, 11], tagId: 1, op: "add" });
  });

  it("warns that another value of the same key is replaced when adding a key value", async () => {
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Pilih Ahmad" }));
    await user.click(screen.getByRole("button", { name: "Tambah tag" }));
    await user.click(screen.getByRole("option", { name: /prioritas:rendah/ }));
    expect(screen.getByText(/nilai lain dari kunci ini akan diganti/i)).toBeInTheDocument();
  });

  it("offers only tags the selected members have when removing", async () => {
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Pilih Ahmad" }));
    await user.click(screen.getByRole("button", { name: "Hapus tag" }));
    expect(screen.getByRole("option", { name: /prioritas:tinggi/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /fokus/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /prioritas:rendah/ })).not.toBeInTheDocument();
  });

  it("removes the chosen tag from the selection and says how many members have it", async () => {
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: /Pilih semua/ }));
    await user.click(screen.getByRole("button", { name: "Hapus tag" }));
    await user.click(screen.getByRole("option", { name: /fokus/ }));
    expect(screen.getByText(/1 dari 3 anggota/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Terapkan" }));
    expect(actions.bulkTagMembersAction).toHaveBeenCalledWith({ memberIds: [10, 11, 12], tagId: 1, op: "remove" });
  });

  it("reports the result, clears the selection and keeps the message readable", async () => {
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: /Pilih semua/ }));
    await user.click(screen.getByRole("button", { name: "Tambah tag" }));
    await user.click(screen.getByRole("option", { name: /fokus/ }));
    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("2 anggota diubah."));
    expect(screen.getAllByText("2 anggota diubah.")).toHaveLength(2); // live region + the visible bar
    expect(screen.queryByRole("button", { name: "Tambah tag" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Pilih Ahmad" })).not.toBeChecked();
  });

  it("says when nothing changed", async () => {
    actions.bulkTagMembersAction.mockResolvedValue({ ok: true, data: { changed: 0 } });
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Pilih Ahmad" }));
    await user.click(screen.getByRole("button", { name: "Tambah tag" }));
    await user.click(screen.getByRole("option", { name: /fokus/ }));
    await user.click(screen.getByRole("button", { name: "Terapkan" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Tidak ada anggota yang berubah."));
  });

  it("keeps the selection and shows the server's message when the action fails", async () => {
    actions.bulkTagMembersAction.mockResolvedValue({ ok: false, error: "Satu data maksimal memiliki 20 tag" });
    render(<Page />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Pilih Ahmad" }));
    await user.click(screen.getByRole("button", { name: "Tambah tag" }));
    await user.click(screen.getByRole("option", { name: /fokus/ }));
    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Satu data maksimal memiliki 20 tag");
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Pilih Ahmad" })).toBeChecked());
  });

  describe("touch layout (task 5.5a)", () => {
    it("gives each row checkbox a 44px hit area below xl", () => {
      render(<Page />);
      const label = screen.getByRole("checkbox", { name: "Pilih Ahmad" }).closest("label");
      expect(label?.className).toContain("size-11");
    });

    it("pins the bar to the bottom of the scroll area above the safe-area inset", async () => {
      render(<Page />);
      await userEvent.setup().click(screen.getByRole("checkbox", { name: "Pilih Ahmad" }));
      const bar = screen.getByRole("button", { name: "Tambah tag" }).closest("[data-slot=bulk-tag-bar]");
      expect(bar?.className).toContain("sticky");
      expect(bar?.className).toContain("bottom-0");
      expect(bar?.className).toContain("safe-area-inset-bottom");
    });

    it("keeps the bar to one row on a phone: short labels and an icon-only Batal that still has its name (task 8.11)", async () => {
      render(<Page />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("checkbox", { name: "Pilih Ahmad" }));

      // The full words stay available to screen readers and from sm up.
      expect(screen.getByRole("status")).toHaveTextContent("1 anggota dipilih");
      expect(screen.getByRole("button", { name: "Tambah tag" })).toHaveTextContent("Tambah");
      expect(screen.getByRole("button", { name: "Hapus tag" })).toHaveTextContent("Hapus");
      const cancel = screen.getByRole("button", { name: "Batal" });
      expect(cancel.className).toContain("w-11");
      expect(cancel.querySelector("svg")).not.toBeNull();

      await user.click(cancel);
      expect(screen.queryByRole("button", { name: "Tambah tag" })).not.toBeInTheDocument();
    });

    it("opens the chooser as a bottom sheet below xl", async () => {
      stubBrowser(false);
      render(<Page />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("checkbox", { name: "Pilih Ahmad" }));
      await user.click(screen.getByRole("button", { name: "Tambah tag" }));
      expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeNull();
      expect(screen.getByRole("option", { name: /fokus/ }).className).toContain("min-h-11");
    });
  });
});
