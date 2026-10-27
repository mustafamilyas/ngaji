// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";

vi.mock("@/app/dashboard/kegiatan/actions", () => ({ endActivityAction: vi.fn() }));

import { endActivityAction } from "@/app/dashboard/kegiatan/actions";
import { EndActivityForm } from "./end-activity-form";

const end = vi.mocked(endActivityAction);
const confirmSpy = vi.fn();

async function fill(user: ReturnType<typeof userEvent.setup>) {
  render(<EndActivityForm activityId={5} />);
  await user.type(screen.getByLabelText("Akhiri mulai tanggal"), "2026-09-30");
  await user.click(screen.getByRole("button", { name: "Akhiri" }));
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
});
