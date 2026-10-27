// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/lib/test/dom";

vi.mock("@/app/dashboard/kegiatan/actions", () => ({ overrideOccurrenceAction: vi.fn() }));

import { overrideOccurrenceAction } from "@/app/dashboard/kegiatan/actions";
import { OccurrenceOverrideDialog } from "./occurrence-override-dialog";

const override = vi.mocked(overrideOccurrenceAction);
type Result = Awaited<ReturnType<typeof overrideOccurrenceAction>>;

const renderDialog = (props: Partial<React.ComponentProps<typeof OccurrenceOverrideDialog>> = {}) =>
  render(
    <OccurrenceOverrideDialog
      activityId={5}
      occurrenceKey="2026-08-20"
      isCancelled={false}
      effectiveDate="2026-08-20"
      effectiveStartTime="19:30"
      effectiveDurationMinutes={90}
      effectiveLocation="Aula"
      effectiveNotes={null}
      {...props}
    />,
  );

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Ubah jadwal/ }));
  return screen.findByRole("dialog");
}

const sent = () => Object.fromEntries((override.mock.calls[0][1] as FormData).entries());

describe("OccurrenceOverrideDialog", () => {
  beforeEach(() => {
    override.mockReset();
  });

  it("names the date in the trigger and the description", async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByRole("button", { name: "Ubah jadwal 20 Agu 2026" })).toBeInTheDocument();
    const dialog = await open(user);
    expect(within(dialog).getByText("Hanya berlaku untuk jadwal 20 Agu 2026; jadwal lain tidak berubah.")).toBeInTheDocument();
  });

  it("starts from the effective values of an unmoved, scheduled occurrence", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);

    expect(within(dialog).getByLabelText("Status")).toHaveValue("SCHEDULED");
    expect(within(dialog).getByLabelText("Pindah ke tanggal")).toHaveValue("");
    expect(within(dialog).getByLabelText("Jam mulai")).toHaveValue("19:30");
    expect(within(dialog).getByLabelText("Durasi (menit)")).toHaveValue(90);
    expect(within(dialog).getByLabelText("Lokasi")).toHaveValue("Aula");
    expect(within(dialog).getByLabelText("Catatan")).toHaveValue("");
  });

  it("shows a moved, cancelled occurrence with its new date, status and notes", async () => {
    const user = userEvent.setup();
    renderDialog({ isCancelled: true, effectiveDate: "2026-08-22", effectiveNotes: "Libur" });
    const dialog = await open(user);

    expect(within(dialog).getByLabelText("Status")).toHaveValue("CANCELLED");
    expect(within(dialog).getByLabelText("Pindah ke tanggal")).toHaveValue("2026-08-22");
    expect(within(dialog).getByLabelText("Catatan")).toHaveValue("Libur");
    // the description still refers to the schedule's own date, not the moved one
    expect(within(dialog).getByText(/jadwal 20 Agu 2026/)).toBeInTheDocument();
  });

  it("sends the activity, the occurrence key and the edited fields, then closes on success", async () => {
    override.mockResolvedValue({ ok: true, data: {} } as unknown as Result);
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);
    await user.selectOptions(within(dialog).getByLabelText("Status"), "CANCELLED");
    await user.clear(within(dialog).getByLabelText("Lokasi"));
    await user.type(within(dialog).getByLabelText("Lokasi"), "Masjid");
    await user.type(within(dialog).getByLabelText("Catatan"), "Hujan");

    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(sent()).toMatchObject({
      activityId: "5",
      date: "2026-08-20",
      status: "CANCELLED",
      overrideStartTime: "19:30",
      overrideDurationMinutes: "90",
      overrideLocation: "Masjid",
      overrideNotes: "Hujan",
    });
  });

  it("keeps the dialog open and shows the server error", async () => {
    override.mockResolvedValue({ ok: false, error: "Tanggal bentrok dengan jadwal lain" });
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Tanggal bentrok dengan jadwal lain");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // Task 10.37: the uncontrolled fields are reset to their defaults by React 19 after the action, errors included,
  // so an edit that the server refuses has to be typed again.
  it.fails("keeps the edited location after a server error", async () => {
    override.mockResolvedValue({ ok: false, error: "Tanggal bentrok dengan jadwal lain" });
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);
    await user.clear(within(dialog).getByLabelText("Lokasi"));
    await user.type(within(dialog).getByLabelText("Lokasi"), "Masjid");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await within(dialog).findByRole("alert");
    expect(within(dialog).getByLabelText("Lokasi")).toHaveValue("Masjid");
  });

  it("Tutup closes the dialog without calling the server", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: "Tutup" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(override).not.toHaveBeenCalled();
  });
});
