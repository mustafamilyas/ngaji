// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/lib/test/dom";

vi.mock("./actions", () => ({
  moveUserAction: vi.fn(),
  resetUserPasswordAction: vi.fn(),
  setUserActiveAction: vi.fn(),
  updateUserRoleAction: vi.fn(),
}));

import { moveUserAction, resetUserPasswordAction, setUserActiveAction, updateUserRoleAction } from "./actions";
import { ManageUserDialog } from "./manage-user-dialog";

const move = vi.mocked(moveUserAction);
const reset = vi.mocked(resetUserPasswordAction);
const setActive = vi.mocked(setUserActiveAction);
const updateRole = vi.mocked(updateUserRoleAction);

const groups = [
  { id: 1, name: "Pusat", parentId: null },
  { id: 3, name: "Kelompok A", parentId: 1 },
  { id: 4, name: "Kelompok B", parentId: 1 },
];

const renderDialog = (props: Partial<React.ComponentProps<typeof ManageUserDialog>> = {}) =>
  render(
    <ManageUserDialog
      userId={9}
      userName="Budi"
      role="USER"
      groupId={3}
      isActive
      canManage
      canReset
      groups={groups}
      {...props}
    />,
  );

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Kelola Budi" }));
  return screen.findByRole("dialog");
}

const formData = (mock: { mock: { calls: unknown[][] } }) => Object.fromEntries((mock.mock.calls[0][1] as FormData).entries());

describe("ManageUserDialog", () => {
  beforeEach(() => {
    for (const mock of [move, reset, setActive, updateRole]) mock.mockReset();
    // jsdom has no layout, so it does not implement scrollIntoView.
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows every section for someone who can manage and reset", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);

    for (const title of ["Peran", "Grup", "Password", "Nonaktifkan akun"]) {
      expect(within(dialog).getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(within(dialog).getByRole("heading", { name: "Budi" })).toBeInTheDocument();
  });

  it("shows only the password section when the viewer can reset but not manage", async () => {
    const user = userEvent.setup();
    renderDialog({ canManage: false });
    const dialog = await open(user);

    expect(within(dialog).getAllByRole("heading").map((h) => h.textContent)).toEqual(["Budi", "Password"]);
  });

  it("labels the toggle 'Aktifkan' for an inactive user", async () => {
    const user = userEvent.setup();
    renderDialog({ isActive: false });
    const dialog = await open(user);

    expect(within(dialog).getByRole("heading", { name: "Aktifkan akun" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Aktifkan" })).toBeInTheDocument();
  });

  it("changes the role", async () => {
    updateRole.mockResolvedValue({ ok: true, data: {} } as never);
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);
    await user.selectOptions(within(dialog).getByDisplayValue("USER"), "ADMIN");

    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(updateRole).toHaveBeenCalled());
    expect(formData(updateRole)).toMatchObject({ userId: "9", role: "ADMIN" });
  });

  it("moves the user only after a different group is picked", async () => {
    move.mockResolvedValue({ ok: true, data: {} } as never);
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);
    const moveButton = within(dialog).getByRole("button", { name: "Pindahkan" });
    expect(moveButton).toBeDisabled(); // still the current group

    const picker = within(dialog).getByRole("combobox", { name: "Pindah ke grup" });
    await user.clear(picker);
    expect(moveButton).toBeDisabled(); // nothing chosen
    await user.type(picker, "Kelompok B");
    await user.click(await within(dialog).findByRole("button", { name: /Kelompok B/ }));
    expect(moveButton).toBeEnabled();
    await user.click(moveButton);

    await waitFor(() => expect(move).toHaveBeenCalled());
    expect(formData(move)).toMatchObject({ userId: "9", groupId: "4" });
  });

  it.each([
    [true, "Nonaktifkan", "false"],
    [false, "Aktifkan", "true"],
  ])("isActive=%s: the toggle sends isActive=%s", async (isActive, label, sent) => {
    setActive.mockResolvedValue({ ok: true, data: {} } as never);
    const user = userEvent.setup();
    renderDialog({ isActive });
    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: label }));

    await waitFor(() => expect(setActive).toHaveBeenCalled());
    expect(formData(setActive)).toMatchObject({ userId: "9", isActive: sent });
  });

  it("shows the temporary password after a reset and scrolls it into view", async () => {
    reset.mockResolvedValue({ ok: true, data: { temporaryPassword: "Xyz-98765" } });
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: "Reset password" }));

    expect(await within(dialog).findByRole("status")).toHaveTextContent("Password baru: Xyz-98765");
    expect(formData(reset)).toMatchObject({ userId: "9" });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    // The message must not sit behind the pinned footer (task 11.48).
    expect(within(dialog).getByRole("status")).toHaveClass("scroll-mb-20");
  });

  it.each([
    ["role", () => updateRole, "Simpan"],
    ["move", () => move, "Pindahkan"],
    ["active", () => setActive, "Nonaktifkan"],
    ["reset", () => reset, "Reset password"],
  ] as const)("shows the %s error as an alert next to its section", async (_name, mock, button) => {
    (mock() as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "Tidak diizinkan" });
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);
    if (button === "Pindahkan") {
      const picker = within(dialog).getByRole("combobox", { name: "Pindah ke grup" });
      await user.clear(picker);
      await user.type(picker, "Kelompok B");
      await user.click(await within(dialog).findByRole("button", { name: /Kelompok B/ }));
    }

    await user.click(within(dialog).getByRole("button", { name: button }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Tidak diizinkan");
    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
  });

  it("Tutup closes the dialog", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: "Tutup" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
