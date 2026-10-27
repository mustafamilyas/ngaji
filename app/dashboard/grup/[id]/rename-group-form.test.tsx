// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";

vi.mock("@/app/dashboard/grup/actions", () => ({ renameGroupAction: vi.fn() }));

import { renameGroupAction } from "@/app/dashboard/grup/actions";
import { RenameGroupForm } from "./rename-group-form";

const rename = vi.mocked(renameGroupAction);

describe("RenameGroupForm", () => {
  beforeEach(() => {
    rename.mockReset();
  });

  it("sends the group id and the edited name", async () => {
    rename.mockResolvedValue({ ok: true, data: {} } as never);
    const user = userEvent.setup();
    render(<RenameGroupForm groupId={6} name="Kelompok A" />);
    const field = screen.getByDisplayValue("Kelompok A");

    await user.clear(field);
    await user.type(field, "Kelompok Satu");
    await user.click(screen.getByRole("button", { name: "Ganti nama" }));

    await vi.waitFor(() => expect(rename).toHaveBeenCalled());
    expect(Object.fromEntries((rename.mock.calls[0][1] as FormData).entries())).toEqual({ groupId: "6", name: "Kelompok Satu" });
  });

  it("keeps the edited name and shows the error when the server refuses", async () => {
    rename.mockResolvedValue({ ok: false, error: "Nama grup sudah dipakai" });
    const user = userEvent.setup();
    render(<RenameGroupForm groupId={6} name="Kelompok A" />);
    const field = screen.getByDisplayValue("Kelompok A");
    await user.clear(field);
    await user.type(field, "Kelompok B");

    await user.click(screen.getByRole("button", { name: "Ganti nama" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nama grup sudah dipakai");
    expect(screen.getByDisplayValue("Kelompok B")).toBeInTheDocument();
  });
});
