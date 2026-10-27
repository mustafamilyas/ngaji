// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/lib/test/dom";

vi.mock("@/app/dashboard/anggota/actions", () => ({ createMemberAction: vi.fn() }));

import { createMemberAction } from "@/app/dashboard/anggota/actions";
import { QuickRegisterDialog } from "./quick-register-dialog";

const create = vi.mocked(createMemberAction);
const onRegistered = vi.fn();

const renderDialog = (props: Partial<React.ComponentProps<typeof QuickRegisterDialog>> = {}) =>
  render(
    <QuickRegisterDialog
      groupId={7}
      groupName="Kelompok A"
      occurrenceDate="2026-08-20"
      today="2026-08-27"
      onRegistered={onRegistered}
      {...props}
    />,
  );

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Daftar sebagai anggota baru/ }));
  return screen.findByRole("dialog");
}

async function fillValid(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  const d = within(dialog);
  await user.type(d.getByLabelText("Nama"), "Siti");
  await user.type(d.getByLabelText("Tempat lahir"), "Bandung");
  await user.type(d.getByLabelText("Tanggal lahir"), "2000-12-28");
  await user.type(d.getByLabelText("No. HP"), "081234567890");
  await user.type(d.getByLabelText("Alamat"), "Jl. Uji 1");
}

describe("QuickRegisterDialog", () => {
  beforeEach(() => {
    create.mockReset();
    onRegistered.mockReset();
  });

  it("is closed until the trigger is pressed, then names the group", async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const dialog = await open(user);

    expect(within(dialog).getByText("Akan didaftarkan di Kelompok A.")).toBeInTheDocument();
  });

  it("disables the trigger without a group", () => {
    renderDialog({ groupId: undefined });
    expect(screen.getByRole("button", { name: /Daftar sebagai anggota baru/ })).toBeDisabled();
  });

  it("shows a field error per missing field and does not call the server", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: "Daftar" }));

    const alerts = (await within(dialog).findAllByRole("alert")).map((a) => a.textContent);
    expect(alerts).toEqual(
      expect.arrayContaining(["Nama wajib diisi", "Tempat lahir wajib diisi", "Alamat wajib diisi", "Nomor HP wajib diisi"]),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("registers the member in the given group with defaults, reports it, and closes", async () => {
    create.mockResolvedValue({ ok: true, data: { id: 42, name: "Siti" } } as Awaited<ReturnType<typeof createMemberAction>>);
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);
    await fillValid(user, dialog);

    await user.click(within(dialog).getByRole("button", { name: "Daftar" }));

    await waitFor(() => expect(onRegistered).toHaveBeenCalledWith({ id: 42, name: "Siti" }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 7,
        name: "Siti",
        status: "AKTIF",
        maritalStatus: "BELUM_MENIKAH",
        workStatus: "BEKERJA",
        // the member joins on the occurrence date (before today) so they are expected at it
        joinedAt: "2026-08-20",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("joins on today when the occurrence date is today or later", async () => {
    create.mockResolvedValue({ ok: true, data: { id: 1, name: "Siti" } } as Awaited<ReturnType<typeof createMemberAction>>);
    const user = userEvent.setup();
    renderDialog({ occurrenceDate: "2026-09-01" });
    const dialog = await open(user);
    await fillValid(user, dialog);

    await user.click(within(dialog).getByRole("button", { name: "Daftar" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ joinedAt: "2026-08-27" })));
  });

  it("keeps the dialog open with the typed values and shows the server error as an alert", async () => {
    create.mockResolvedValue({ ok: false, error: "Data tidak valid" });
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);
    await fillValid(user, dialog);

    await user.click(within(dialog).getByRole("button", { name: "Daftar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Data tidak valid");
    expect(within(dialog).getByLabelText("Nama")).toHaveValue("Siti");
    expect(within(dialog).getByRole("button", { name: "Daftar" })).toBeEnabled();
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it("Batal closes the dialog without calling the server", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: "Batal" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(create).not.toHaveBeenCalled();
  });
});
