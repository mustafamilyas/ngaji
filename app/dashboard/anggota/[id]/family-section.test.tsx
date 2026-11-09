// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/lib/test/dom";

const actions = vi.hoisted(() => ({
  linkMembersAction: vi.fn(),
  unlinkMembersAction: vi.fn(),
  searchRelativeCandidatesAction: vi.fn(),
}));
vi.mock("@/app/dashboard/anggota/actions", () => actions);

import type { Relative } from "@/lib/member/relation-queries";
import { FamilySection } from "./family-section";

const inScope: Relative = { inScope: true, memberId: 7, relationId: 70, label: "Ayah", name: "Ahmad", groupName: "Kelompok A" };
const outOfScope: Relative = { inScope: false, label: "Ibu", name: "Siti", groupName: "Kelompok B" };

function renderSection(relatives: Relative[]) {
  return render(<FamilySection memberId={1} memberName="Fatimah" relatives={relatives} />);
}

describe("FamilySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.searchRelativeCandidatesAction.mockResolvedValue({ ok: true, data: [] });
  });

  it("links an in-scope relative to its page and shows an out-of-scope one as plain text without remove", () => {
    renderSection([inScope, outOfScope]);

    expect(screen.getByRole("link", { name: "Ahmad" })).toHaveAttribute("href", "/dashboard/anggota/7");
    expect(screen.getByText("Siti")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Siti" })).not.toBeInTheDocument();
    expect(screen.getByText("Ibu")).toBeInTheDocument();
    expect(screen.getByText("Kelompok B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hapus hubungan Ayah Ahmad" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hapus hubungan Ibu/ })).not.toBeInTheDocument();
  });

  it("says so when there are no relatives", () => {
    renderSection([]);
    expect(screen.getByText("Belum ada data keluarga")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tambah keluarga" })).toBeInTheDocument();
  });

  it("links the picked member with the direction chosen in plain words", async () => {
    const user = userEvent.setup();
    actions.searchRelativeCandidatesAction.mockResolvedValue({
      ok: true,
      data: [{ id: 9, name: "Budi", groupName: "Kelompok A", code: "YNN-ABC234" }],
    });
    actions.linkMembersAction.mockResolvedValue({ ok: true, data: {} });
    renderSection([]);

    await user.click(screen.getByRole("button", { name: "Tambah keluarga" }));
    await user.selectOptions(screen.getByLabelText("Fatimah"), "ORANG_TUA_TO");
    await user.type(screen.getByLabelText(/Cari anggota/), "bud");
    await user.click(await screen.findByRole("radio", { name: /Budi/ }));
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    // "Fatimah adalah Anak dari Budi": Budi is the parent (from), Fatimah the child (to).
    await waitFor(() => expect(actions.linkMembersAction).toHaveBeenCalledWith({ fromMemberId: 9, toMemberId: 1, type: "ORANG_TUA" }));
    expect(actions.searchRelativeCandidatesAction).toHaveBeenCalledWith({ memberId: 1, query: "bud" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the dialog and the typed search when the server refuses", async () => {
    const user = userEvent.setup();
    actions.searchRelativeCandidatesAction.mockResolvedValue({
      ok: true,
      data: [{ id: 9, name: "Budi", groupName: "Kelompok A", code: null }],
    });
    actions.linkMembersAction.mockResolvedValue({ ok: false, error: "Kedua anggota sudah memiliki hubungan" });
    renderSection([]);

    await user.click(screen.getByRole("button", { name: "Tambah keluarga" }));
    await user.type(screen.getByLabelText(/Cari anggota/), "bud");
    await user.click(await screen.findByRole("radio", { name: /Budi/ }));
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Kedua anggota sudah memiliki hubungan");
    expect(screen.getByLabelText(/Cari anggota/)).toHaveValue("bud");
  });

  it("asks to pick a member before submitting", async () => {
    const user = userEvent.setup();
    renderSection([]);

    await user.click(screen.getByRole("button", { name: "Tambah keluarga" }));
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Pilih anggota terlebih dahulu");
    expect(actions.linkMembersAction).not.toHaveBeenCalled();
  });

  it("removes a relative only after confirming in the dialog", async () => {
    const user = userEvent.setup();
    actions.unlinkMembersAction.mockResolvedValue({ ok: true, data: null });
    renderSection([inScope]);

    await user.click(screen.getByRole("button", { name: "Hapus hubungan Ayah Ahmad" }));
    expect(actions.unlinkMembersAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Hapus" }));
    await waitFor(() => expect(actions.unlinkMembersAction).toHaveBeenCalledWith({ relationId: 70 }));
  });
});
