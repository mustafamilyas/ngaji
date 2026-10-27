// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";

vi.mock("@/app/dashboard/kegiatan/actions", () => ({ endActivityAction: vi.fn() }));

import { endActivityAction } from "@/app/dashboard/kegiatan/actions";
import { EndActivityForm } from "./end-activity-form";

const end = vi.mocked(endActivityAction);
const confirmSpy = vi.fn();

async function fill(user: ReturnType<typeof userEvent.setup>, date = "2026-09-30") {
  render(<EndActivityForm activityId={5} startsOn="2026-03-01" />);
  await user.type(screen.getByLabelText("Akhiri mulai tanggal"), date);
  await user.click(screen.getByRole("button", { name: /^(Akhiri|Hapus kegiatan)$/ }));
}

describe("EndActivityForm", () => {
  beforeEach(() => {
    end.mockReset();
    confirmSpy.mockReset();
    vi.stubGlobal("confirm", confirmSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for confirmation and sends the activity id and the date", async () => {
    confirmSpy.mockReturnValue(true);
    end.mockResolvedValue({ ok: true, data: {} } as never);

    await fill(userEvent.setup());

    await vi.waitFor(() => expect(end).toHaveBeenCalled());
    expect(confirmSpy).toHaveBeenCalledWith("Akhiri kegiatan ini mulai tanggal yang dipilih?");
    expect(Object.fromEntries((end.mock.calls[0][1] as FormData).entries())).toEqual({ activityId: "5", fromDate: "2026-09-30" });
  });

  it("does nothing when the confirmation is declined, and keeps the date", async () => {
    confirmSpy.mockReturnValue(false);

    await fill(userEvent.setup());

    expect(end).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Akhiri mulai tanggal")).toHaveValue("2026-09-30");
  });

  it("keeps the date and shows the error when the server refuses", async () => {
    confirmSpy.mockReturnValue(true);
    end.mockResolvedValue({ ok: false, error: "Tanggal sebelum kegiatan dimulai" });

    await fill(userEvent.setup());

    expect(await screen.findByRole("alert")).toHaveTextContent("Tanggal sebelum kegiatan dimulai");
    expect(screen.getByLabelText("Akhiri mulai tanggal")).toHaveValue("2026-09-30");
  });

  describe("a date on or before the start date deletes the activity", () => {
    const hint = /kegiatan akan dihapus dari daftar/i;

    it("shows no warning for a date after the start date, and the usual prompt", async () => {
      confirmSpy.mockReturnValue(false);

      await fill(userEvent.setup());

      expect(screen.queryByText(hint)).not.toBeInTheDocument();
      expect(confirmSpy).toHaveBeenCalledWith("Akhiri kegiatan ini mulai tanggal yang dipilih?");
    });

    it("shows no warning before a date is chosen", () => {
      render(<EndActivityForm activityId={5} startsOn="2026-03-01" />);
      expect(screen.queryByText(hint)).not.toBeInTheDocument();
    });

    it.each(["2026-03-01", "2026-02-15"])("warns under the field as soon as the date is %s, naming the start date", async (date) => {
      const user = userEvent.setup();
      render(<EndActivityForm activityId={5} startsOn="2026-03-01" />);

      await user.type(screen.getByLabelText("Akhiri mulai tanggal"), date);

      const warning = screen.getByText(hint);
      expect(warning).toHaveTextContent("1 Mar 2026");
      // announced to screen readers without stealing focus
      expect(warning).toHaveAttribute("role", "status");
      // the button says what it will do, and stops looking like the harmless variant
      expect(screen.getByRole("button", { name: "Hapus kegiatan" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Akhiri" })).not.toBeInTheDocument();
    });

    it("removes the warning when the date is changed to a later one", async () => {
      const user = userEvent.setup();
      render(<EndActivityForm activityId={5} startsOn="2026-03-01" />);
      const field = screen.getByLabelText("Akhiri mulai tanggal");
      await user.type(field, "2026-03-01");
      expect(screen.getByText(hint)).toBeInTheDocument();

      await user.clear(field);
      await user.type(field, "2026-03-02");

      expect(screen.queryByText(hint)).not.toBeInTheDocument();
    });

    it("makes the confirm prompt say the activity will be deleted, and still sends the date when confirmed", async () => {
      confirmSpy.mockReturnValue(true);
      end.mockResolvedValue({ ok: true, data: {} } as never);

      await fill(userEvent.setup(), "2026-03-01");

      expect(confirmSpy).toHaveBeenCalledOnce();
      expect(confirmSpy.mock.calls[0][0]).toMatch(/dihapus/i);
      await vi.waitFor(() => expect(end).toHaveBeenCalled());
      expect(Object.fromEntries((end.mock.calls[0][1] as FormData).entries())).toMatchObject({ fromDate: "2026-03-01" });
    });

    it("sends nothing when that stronger prompt is declined", async () => {
      confirmSpy.mockReturnValue(false);

      await fill(userEvent.setup(), "2026-03-01");

      expect(end).not.toHaveBeenCalled();
    });
  });
});
