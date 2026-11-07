// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_IMPORT_FILE_BYTES } from "@/lib/constants";
import { render, screen, userEvent, within } from "@/lib/test/dom";
import type { ImportReport } from "@/lib/member/import/analyze";

vi.mock("./actions", () => ({ previewMemberImportAction: vi.fn(), confirmMemberImportAction: vi.fn() }));

import { confirmMemberImportAction, previewMemberImportAction } from "./actions";
import { ImportForm } from "./import-form";

const preview = vi.mocked(previewMemberImportAction);
const confirm = vi.mocked(confirmMemberImportAction);

const report = (overrides: Partial<ImportReport> = {}): ImportReport => ({
  validCount: 2,
  invalidCount: 0,
  duplicateCount: 0,
  errors: [],
  totalErrors: 0,
  ignoredColumns: [],
  usedGroupColumn: false,
  ...overrides,
});
const csv = (name = "anggota.csv") => new File(["nama\nBudi"], name, { type: "text/csv" });
const groups = [{ id: 7, name: "Kelompok 1", parentName: "Desa A" }];

async function pickFileAndCheck(user: ReturnType<typeof userEvent.setup>, file = csv()) {
  await user.upload(screen.getByLabelText("File CSV"), file);
  await user.click(screen.getByRole("button", { name: "Periksa file" }));
}

describe("ImportForm", () => {
  beforeEach(() => {
    preview.mockReset();
    confirm.mockReset();
  });

  it("offers the template download and a collapsible column help", () => {
    render(<ImportForm leafGroups={groups} />);

    expect(screen.getByRole("link", { name: /template/i })).toHaveAttribute("href", "/dashboard/anggota/impor/template");
    const help = screen.getByText("Format kolom").closest("details");
    expect(help).not.toHaveAttribute("open");
    expect(within(help as HTMLElement).getByText("tanggal_lahir")).toBeInTheDocument();
    expect(within(help as HTMLElement).getByText("grup")).toBeInTheDocument();
  });

  it("refuses a file that is not .csv without calling the server", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ImportForm leafGroups={groups} />);

    await pickFileAndCheck(user, csv("anggota.xlsx"));

    expect(await screen.findByRole("alert")).toHaveTextContent("CSV");
    expect(preview).not.toHaveBeenCalled();
  });

  it("refuses a file over the size limit without calling the server", async () => {
    const user = userEvent.setup();
    render(<ImportForm leafGroups={groups} />);

    await pickFileAndCheck(user, new File([new Uint8Array(MAX_IMPORT_FILE_BYTES + 1)], "besar.csv"));

    expect(await screen.findByRole("alert")).toHaveTextContent("batas");
    expect(preview).not.toHaveBeenCalled();
  });

  it("sends the file and the chosen group, then shows the counts", async () => {
    preview.mockResolvedValue({ ok: true, data: report({ validCount: 2, duplicateCount: 0 }) });
    const user = userEvent.setup();
    render(<ImportForm leafGroups={groups} />);

    await pickFileAndCheck(user);

    const sent = preview.mock.calls[0][0];
    expect((sent.get("file") as File).name).toBe("anggota.csv");
    expect(sent.get("groupId")).toBe("7");
    expect(await screen.findByText("2 baris siap diimpor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Impor 2 anggota" })).toBeEnabled();
  });

  it("lists errors by spreadsheet row and column, states the total, and blocks the import", async () => {
    preview.mockResolvedValue({
      ok: true,
      data: report({
        validCount: 1,
        invalidCount: 2,
        totalErrors: 150,
        errors: [
          { rowNumber: 4, column: "tanggal_lahir", message: "Tanggal tidak valid" },
          { rowNumber: 9, column: "grup", message: "Grup tidak ditemukan" },
        ],
      }),
    });
    const user = userEvent.setup();
    render(<ImportForm leafGroups={groups} />);

    await pickFileAndCheck(user);

    expect(await screen.findByText("Baris 4, kolom tanggal_lahir: Tanggal tidak valid")).toBeInTheDocument();
    expect(screen.getByText("Baris 9, kolom grup: Grup tidak ditemukan")).toBeInTheDocument();
    expect(screen.getByText("Menampilkan 2 dari 150 kesalahan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Impor \d+ anggota$/ })).not.toBeInTheDocument();
  });

  it("names ignored columns", async () => {
    preview.mockResolvedValue({ ok: true, data: report({ ignoredColumns: ["catatan"] }) });
    const user = userEvent.setup();
    render(<ImportForm leafGroups={groups} />);

    await pickFileAndCheck(user);

    expect(await screen.findByText(/Kolom diabaikan: catatan/)).toBeInTheDocument();
  });

  it("shows the server's message when the file is rejected", async () => {
    preview.mockResolvedValue({ ok: false, error: "Kolom wajib tidak ditemukan: alamat." });
    const user = userEvent.setup();
    render(<ImportForm leafGroups={groups} />);

    await pickFileAndCheck(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Kolom wajib tidak ditemukan: alamat.");
  });

  it("confirms, then reports the counts with a link to the group's list", async () => {
    preview.mockResolvedValue({ ok: true, data: report({ validCount: 3, duplicateCount: 1 }) });
    confirm.mockResolvedValue({ ok: true, data: { status: "done", created: 2, skipped: 1, importId: "x", groupId: 7, groupIds: [7] } });
    const user = userEvent.setup();
    render(<ImportForm leafGroups={groups} />);
    await pickFileAndCheck(user);

    await user.click(await screen.findByRole("button", { name: "Impor 2 anggota" }));

    expect(await screen.findByText("2 anggota dibuat, 1 duplikat dilewati")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /daftar anggota grup/i })).toHaveAttribute("href", "/dashboard/grup/7");
    expect(confirm.mock.calls[0][0].get("force")).toBeNull();
  });

  it("links to the Anggota list when the file named its own groups", async () => {
    preview.mockResolvedValue({ ok: true, data: report({ usedGroupColumn: true }) });
    confirm.mockResolvedValue({ ok: true, data: { status: "done", created: 2, skipped: 0, importId: "x", groupId: null, groupIds: [7, 8] } });
    const user = userEvent.setup();
    render(<ImportForm leafGroups={groups} />);
    await pickFileAndCheck(user);

    await user.click(await screen.findByRole("button", { name: "Impor 2 anggota" }));

    expect(await screen.findByRole("link", { name: /daftar anggota/i })).toHaveAttribute("href", "/dashboard/anggota");
  });

  it("keeps the import unavailable while every row is a duplicate, until Tetap impor is ticked", async () => {
    preview.mockResolvedValue({ ok: true, data: report({ validCount: 2, duplicateCount: 2 }) });
    confirm.mockResolvedValue({ ok: true, data: { status: "done", created: 2, skipped: 0, importId: "x", groupId: 7, groupIds: [7] } });
    const user = userEvent.setup();
    render(<ImportForm leafGroups={groups} />);
    await pickFileAndCheck(user);

    expect(await screen.findByRole("button", { name: "Impor 0 anggota" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Tetap impor/ }));
    await user.click(screen.getByRole("button", { name: "Impor 2 anggota" }));

    expect(confirm.mock.calls[0][0].get("force")).toBe("on");
  });

  it("counts only the rows that will be imported in the preview heading", async () => {
    preview.mockResolvedValue({ ok: true, data: report({ validCount: 3, duplicateCount: 3 }) });
    const user = userEvent.setup();
    render(<ImportForm leafGroups={groups} />);
    await pickFileAndCheck(user);

    expect(await screen.findByText("0 baris siap diimpor")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Tetap impor/ }));

    expect(screen.getByText("3 baris siap diimpor")).toBeInTheDocument();
  });

  it("shows the report again when confirm finds an invalid row", async () => {
    preview.mockResolvedValue({ ok: true, data: report() });
    confirm.mockResolvedValue({
      ok: true,
      data: { status: "invalid", report: report({ invalidCount: 1, totalErrors: 1, errors: [{ rowNumber: 3, column: "alamat", message: "Wajib diisi" }] }) },
    });
    const user = userEvent.setup();
    render(<ImportForm leafGroups={groups} />);
    await pickFileAndCheck(user);

    await user.click(await screen.findByRole("button", { name: "Impor 2 anggota" }));

    expect(await screen.findByText("Baris 3, kolom alamat: Wajib diisi")).toBeInTheDocument();
    expect(screen.queryByText(/anggota dibuat/)).not.toBeInTheDocument();
  });

  it("drops the preview when another file is chosen", async () => {
    preview.mockResolvedValue({ ok: true, data: report() });
    const user = userEvent.setup();
    render(<ImportForm leafGroups={groups} />);
    await pickFileAndCheck(user);
    await screen.findByText("2 baris siap diimpor");

    await user.upload(screen.getByLabelText("File CSV"), csv("lain.csv"));

    expect(screen.queryByText("2 baris siap diimpor")).not.toBeInTheDocument();
  });
});
