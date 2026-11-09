// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/lib/test/dom";

vi.mock("./actions", () => ({ createUserAction: vi.fn() }));

import { createUserAction } from "./actions";
import { CreateUserDialog } from "./create-user-dialog";

const create = vi.mocked(createUserAction);
type Result = Awaited<ReturnType<typeof createUserAction>>;

const groups = [
  { id: 1, name: "Pusat", parentId: null },
  { id: 3, name: "Kelompok A", parentId: 1 },
  { id: 4, name: "Kelompok B", parentId: 1 },
];

const renderDialog = (allowedRoles: readonly ("OWNER" | "ADMIN" | "USER")[] = ["ADMIN", "USER"]) =>
  render(<CreateUserDialog groups={groups} allowedRoles={allowedRoles} />);

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Tambah pengguna/ }));
  return screen.findByRole("dialog");
}

async function pickGroup(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, name: string) {
  await user.type(within(dialog).getByRole("combobox", { name: "Grup" }), name);
  await user.click(await within(dialog).findByRole("button", { name: new RegExp(name) }));
}

describe("CreateUserDialog", () => {
  beforeEach(() => {
    create.mockReset();
  });

  it("is closed until the trigger is pressed", async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const dialog = await open(user);

    expect(within(dialog).getByText(/Password sementara dibuat otomatis/)).toBeInTheDocument();
  });

  it("offers only the allowed roles", async () => {
    const user = userEvent.setup();
    renderDialog(["USER"]);
    const dialog = await open(user);

    const options = within(within(dialog).getByLabelText("Peran")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["USER"]);
  });

  it("keeps 'Buat pengguna' disabled until a group is chosen from the picker", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);
    const submit = within(dialog).getByRole("button", { name: "Buat pengguna" });
    expect(submit).toBeDisabled();

    await pickGroup(user, dialog, "Kelompok A");

    expect(submit).toBeEnabled();
  });

  it("sends the picked group, name, username and role, then shows the temporary password and resets the form", async () => {
    create.mockResolvedValue({
      ok: true,
      data: { user: { username: "budi" }, temporaryPassword: "Abc-12345" },
    } as unknown as Result);
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);
    await pickGroup(user, dialog, "Kelompok A");
    await user.type(within(dialog).getByLabelText("Nama"), "Budi Santoso");
    await user.type(within(dialog).getByLabelText("Username"), "budi");
    await user.selectOptions(within(dialog).getByLabelText("Peran"), "USER");

    await user.click(within(dialog).getByRole("button", { name: "Buat pengguna" }));

    const status = await within(dialog).findByRole("status");
    expect(status).toHaveTextContent("Pengguna budi dibuat.");
    expect(status).toHaveTextContent("Password sementara: Abc-12345");
    const formData = create.mock.calls[0][1];
    expect(Object.fromEntries(formData.entries())).toMatchObject({ groupId: "3", name: "Budi Santoso", username: "budi", role: "USER" });
    // The dialog stays open (the password must be noted) and is ready for the next user.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByLabelText("Nama")).toHaveValue(""));
    expect(within(dialog).getByRole("combobox", { name: "Grup" })).toHaveValue("");
    expect(within(dialog).getByRole("button", { name: "Buat pengguna" })).toBeDisabled();
  });

  async function submitWithServerError() {
    create.mockResolvedValue({ ok: false, error: "Username sudah dipakai" });
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);
    await pickGroup(user, dialog, "Kelompok B");
    await user.type(within(dialog).getByLabelText("Nama"), "Budi");
    await user.type(within(dialog).getByLabelText("Username"), "budi");
    await user.click(within(dialog).getByRole("button", { name: "Buat pengguna" }));
    return dialog;
  }

  it("shows the server error as an alert and no password, and keeps the chosen group", async () => {
    const dialog = await submitWithServerError();

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Username sudah dipakai");
    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "Grup" })).toHaveValue("Kelompok B");
  });

  it("keeps the typed name and username after a server error", async () => {
    const dialog = await submitWithServerError();

    await within(dialog).findByRole("alert");
    expect(within(dialog).getByLabelText("Username")).toHaveValue("budi");
  });

  it("Tutup closes the dialog without calling the server", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: "Tutup" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(create).not.toHaveBeenCalled();
  });
});
