// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/lib/test/dom";

vi.mock("./actions", () => ({ updateOrganizationAction: vi.fn() }));

import { OrganizationForm } from "./organization-form";
import { updateOrganizationAction } from "./actions";

const action = vi.mocked(updateOrganizationAction);
const saved = { ok: true, data: {} } as unknown as Awaited<ReturnType<typeof updateOrganizationAction>>;

describe("OrganizationForm", () => {
  beforeEach(() => {
    action.mockReset();
  });

  it("starts with the saved name and timezone", () => {
    render(<OrganizationForm name="Majelis An-Nur" timezone="Asia/Jayapura" />);

    expect(screen.getByLabelText("Nama organisasi")).toHaveValue("Majelis An-Nur");
    expect(screen.getByLabelText("Zona waktu")).toHaveValue("Asia/Jayapura");
  });

  it("sends the edited fields and shows 'Tersimpan.' and the new timezone once the server re-renders", async () => {
    action.mockResolvedValue(saved);
    const user = userEvent.setup();
    const { rerender } = render(<OrganizationForm name="Majelis An-Nur" timezone="Asia/Jayapura" />);

    await user.clear(screen.getByLabelText("Nama organisasi"));
    await user.type(screen.getByLabelText("Nama organisasi"), "Majelis Baru");
    await user.selectOptions(screen.getByLabelText("Zona waktu"), "Asia/Jakarta");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Tersimpan.");
    const formData = action.mock.calls[0][1];
    expect(formData.get("name")).toBe("Majelis Baru");
    expect(formData.get("timezone")).toBe("Asia/Jakarta");

    // Task 10.6: React resets the form to its first-mount defaults after the action; the select must show the saved zone.
    rerender(<OrganizationForm name="Majelis Baru" timezone="Asia/Jakarta" />);
    expect(screen.getByLabelText("Zona waktu")).toHaveValue("Asia/Jakarta");
  });

  it("shows the server error as an alert and no success message", async () => {
    action.mockResolvedValue({ ok: false, error: "Anda tidak berhak mengubah organisasi" });
    const user = userEvent.setup();
    render(<OrganizationForm name="Majelis An-Nur" timezone="Asia/Jayapura" />);

    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Anda tidak berhak mengubah organisasi");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps the edited name and timezone when the server refuses", async () => {
    action.mockResolvedValue({ ok: false, error: "Nama organisasi sudah dipakai" });
    const user = userEvent.setup();
    render(<OrganizationForm name="Majelis An-Nur" timezone="Asia/Jayapura" />);
    await user.clear(screen.getByLabelText("Nama organisasi"));
    await user.type(screen.getByLabelText("Nama organisasi"), "Majelis Baru");
    await user.selectOptions(screen.getByLabelText("Zona waktu"), "Asia/Jakarta");

    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nama organisasi sudah dipakai");
    expect(screen.getByLabelText("Nama organisasi")).toHaveValue("Majelis Baru");
    expect(screen.getByLabelText("Zona waktu")).toHaveValue("Asia/Jakarta");
  });

  it("disables the button while saving", async () => {
    let finish!: (value: typeof saved) => void;
    action.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<OrganizationForm name="Majelis An-Nur" timezone="Asia/Jayapura" />);

    await user.click(screen.getByRole("button", { name: "Simpan" }));
    expect(await screen.findByRole("button", { name: "Menyimpan…" })).toBeDisabled();

    finish(saved);
    await waitFor(() => expect(screen.getByRole("button", { name: "Simpan" })).toBeEnabled());
  });
});
