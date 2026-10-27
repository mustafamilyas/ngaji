// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/lib/test/dom";

vi.mock("@/app/dashboard/grup/actions", () => ({ createGroupAction: vi.fn() }));

import { createGroupAction } from "@/app/dashboard/grup/actions";
import { AddSubgroupDialog } from "./add-subgroup-dialog";

const create = vi.mocked(createGroupAction);
type Result = Awaited<ReturnType<typeof createGroupAction>>;

const renderDialog = (childLevelName = "Kelompok") =>
  render(<AddSubgroupDialog parentId={7} parentName="Desa Menteng" childLevelName={childLevelName} />);

describe("AddSubgroupDialog", () => {
  beforeEach(() => {
    create.mockReset();
  });

  it("names the level and the parent", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /Tambah kelompok/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Tambah kelompok" })).toBeInTheDocument();
    expect(within(dialog).getByText("Akan dibuat di bawah Desa Menteng.")).toBeInTheDocument();
  });

  it("falls back to 'sub-grup' when the level has no name", () => {
    renderDialog("");
    expect(screen.getByRole("button", { name: /Tambah sub-grup/ })).toBeInTheDocument();
  });

  it("sends the parent id and name, and closes on success", async () => {
    create.mockResolvedValue({ ok: true, data: {} } as unknown as Result);
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: /Tambah kelompok/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Nama")).toHaveFocus();

    await user.type(within(dialog).getByLabelText("Nama"), "Kelompok C");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(Object.fromEntries((create.mock.calls[0][1] as FormData).entries())).toMatchObject({ parentId: "7", name: "Kelompok C" });
  });

  it("keeps the dialog open and shows the server error", async () => {
    create.mockResolvedValue({ ok: false, error: "Nama grup sudah dipakai" });
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: /Tambah kelompok/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nama"), "Kelompok A");

    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Nama grup sudah dipakai");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // Task 10.37: the uncontrolled name field is reset by React 19 after the action, errors included.
  it.fails("keeps the typed name after a server error", async () => {
    create.mockResolvedValue({ ok: false, error: "Nama grup sudah dipakai" });
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: /Tambah kelompok/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nama"), "Kelompok A");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await within(dialog).findByRole("alert");
    expect(within(dialog).getByLabelText("Nama")).toHaveValue("Kelompok A");
  });

  it("Batal closes without calling the server", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: /Tambah kelompok/ }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Batal" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(create).not.toHaveBeenCalled();
  });
});
