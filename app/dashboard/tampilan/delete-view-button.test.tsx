// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/lib/test/dom";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/app/dashboard/tampilan/actions", () => ({ deleteMemberViewAction: vi.fn() }));

import { deleteMemberViewAction } from "@/app/dashboard/tampilan/actions";
import { DeleteViewButton } from "./delete-view-button";

const remove = vi.mocked(deleteMemberViewAction);

async function open(user: ReturnType<typeof userEvent.setup>) {
  render(<DeleteViewButton viewId={4} viewName="Pemuda Aktif" />);
  await user.click(screen.getByRole("button", { name: "Hapus tampilan" }));
  return screen.findByRole("dialog");
}

describe("DeleteViewButton", () => {
  beforeEach(() => {
    remove.mockReset();
    push.mockReset();
  });

  it("asks for confirmation naming the view, without deleting yet", async () => {
    const dialog = await open(userEvent.setup());

    expect(within(dialog).getByRole("heading", { name: "Hapus tampilan?" })).toBeInTheDocument();
    expect(within(dialog).getByText(/Tampilan "Pemuda Aktif" akan hilang dari daftar/)).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
  });

  it("deletes the view and goes back to the list", async () => {
    remove.mockResolvedValue({ ok: true, data: null });
    const user = userEvent.setup();
    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: "Hapus" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/tampilan"));
    expect(remove).toHaveBeenCalledWith({ viewId: 4 });
  });

  it("shows the server error and stays on the page", async () => {
    remove.mockResolvedValue({ ok: false, error: "Tampilan tidak ditemukan" });
    const user = userEvent.setup();
    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: "Hapus" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Tampilan tidak ditemukan");
    expect(push).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("button", { name: "Hapus" })).toBeEnabled();
  });

  it("Batal closes without deleting", async () => {
    const user = userEvent.setup();
    const dialog = await open(user);

    await user.click(within(dialog).getByRole("button", { name: "Batal" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(remove).not.toHaveBeenCalled();
  });
});
