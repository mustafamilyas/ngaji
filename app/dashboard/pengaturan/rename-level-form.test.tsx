// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";

vi.mock("./level-actions", () => ({ renameLevelAction: vi.fn() }));

import { renameLevelAction } from "./level-actions";
import { RenameLevelForm } from "./rename-level-form";

const rename = vi.mocked(renameLevelAction);

describe("RenameLevelForm", () => {
  beforeEach(() => {
    rename.mockReset();
  });

  it("starts with the level name and sends the depth and the edited name", async () => {
    rename.mockResolvedValue({ ok: true, data: {} } as never);
    const user = userEvent.setup();
    render(<RenameLevelForm depth={2} name="Desa" />);
    const field = screen.getByLabelText("Nama jenjang 3");
    expect(field).toHaveValue("Desa");

    await user.clear(field);
    await user.type(field, "Kelurahan");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    await vi.waitFor(() => expect(rename).toHaveBeenCalled());
    expect(Object.fromEntries((rename.mock.calls[0][1] as FormData).entries())).toEqual({ depth: "2", name: "Kelurahan" });
  });

  it("keeps the edited name and shows the error when the server refuses", async () => {
    rename.mockResolvedValue({ ok: false, error: "Nama jenjang sudah dipakai" });
    const user = userEvent.setup();
    render(<RenameLevelForm depth={2} name="Desa" />);
    await user.clear(screen.getByLabelText("Nama jenjang 3"));
    await user.type(screen.getByLabelText("Nama jenjang 3"), "Daerah");

    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nama jenjang sudah dipakai");
    expect(screen.getByLabelText("Nama jenjang 3")).toHaveValue("Daerah");
  });
});
