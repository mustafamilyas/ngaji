// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";

vi.mock("./actions", () => ({ submitInterestAction: vi.fn() }));

import { submitInterestAction } from "./actions";
import { InterestForm } from "./interest-form";

const submit = vi.mocked(submitInterestAction);
const assign = vi.fn();

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nama Anda"), "Budi");
  await user.type(screen.getByLabelText("Nomor WhatsApp"), "0812-3456-7890");
  await user.type(screen.getByLabelText("Nama organisasi"), "Majelis An-Nur");
  await user.click(screen.getByLabelText("Saya setuju data ini dipakai untuk menghubungi saya"));
}

describe("InterestForm", () => {
  beforeEach(() => {
    submit.mockReset();
    assign.mockReset();
    vi.stubGlobal("location", { ...window.location, assign });
  });

  it("shows a field error for each missing required field and does not call the server", async () => {
    const user = userEvent.setup();
    render(<InterestForm />);

    await user.click(screen.getByRole("button", { name: "Kirim" }));

    const alerts = (await screen.findAllByRole("alert")).map((a) => a.textContent);
    expect(alerts).toEqual(
      expect.arrayContaining(["Nama wajib diisi", "Nomor WhatsApp tidak valid", "Nama organisasi wajib diisi", "Persetujuan wajib dicentang"]),
    );
    expect(screen.getByLabelText("Nama Anda")).toHaveAttribute("aria-invalid", "true");
    expect(submit).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric member count on the client", async () => {
    const user = userEvent.setup();
    render(<InterestForm />);
    await fillValid(user);
    await user.type(screen.getByLabelText("Perkiraan jumlah anggota (opsional)"), "banyak");

    await user.click(screen.getByRole("button", { name: "Kirim" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Jumlah anggota harus berupa angka");
    expect(submit).not.toHaveBeenCalled();
  });

  it("sends the values, shows the success state with the WhatsApp link and navigates there", async () => {
    submit.mockResolvedValue({ ok: true, data: { whatsappUrl: "https://wa.me/628111?text=halo" } });
    const user = userEvent.setup();
    render(<InterestForm />);
    await fillValid(user);

    await user.click(screen.getByRole("button", { name: "Kirim" }));

    expect(await screen.findByText("Terima kasih, data Anda sudah kami terima.")).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Budi", phone: "0812-3456-7890", organizationName: "Majelis An-Nur", consent: true, website: "" }),
    );
    expect(screen.getByRole("link", { name: "Lanjut ke WhatsApp" })).toHaveAttribute("href", "https://wa.me/628111?text=halo");
    expect(assign).toHaveBeenCalledWith("https://wa.me/628111?text=halo");
    expect(screen.queryByRole("button", { name: "Kirim" })).not.toBeInTheDocument();
  });

  it("shows the thank-you without a link or navigation when the server has no WhatsApp number", async () => {
    submit.mockResolvedValue({ ok: true, data: { whatsappUrl: null } });
    const user = userEvent.setup();
    render(<InterestForm />);
    await fillValid(user);

    await user.click(screen.getByRole("button", { name: "Kirim" }));

    expect(await screen.findByText("Kami akan menghubungi Anda lewat WhatsApp secepatnya.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Lanjut ke WhatsApp" })).not.toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it.each([
    ["rate limit", "Terlalu banyak pendaftaran dari jaringan ini, coba lagi nanti"],
    ["tampered input", "Data tidak valid"],
  ])("shows the server's %s message as a form-level alert and keeps the typed values", async (_case, message) => {
    submit.mockResolvedValue({ ok: false, error: message });
    const user = userEvent.setup();
    render(<InterestForm />);
    await fillValid(user);

    await user.click(screen.getByRole("button", { name: "Kirim" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("Nama Anda")).toHaveValue("Budi");
    expect(screen.getByRole("button", { name: "Kirim" })).toBeEnabled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("keeps the honeypot out of the accessibility tree and empty by default", () => {
    render(<InterestForm />);

    const honeypot = document.getElementById("website") as HTMLInputElement;
    expect(honeypot).toHaveValue("");
    expect(honeypot.tabIndex).toBe(-1);
    expect(honeypot.closest("[aria-hidden=true]")).not.toBeNull();
  });
});
