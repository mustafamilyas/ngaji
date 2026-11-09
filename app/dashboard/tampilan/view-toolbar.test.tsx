// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeDraft } from "@/lib/member-view/draft";
import { render, screen, userEvent, within } from "@/lib/test/dom";
import { newViewDefinition, type Definition } from "@/lib/validation/member-view";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { ViewToolbar } from "./view-toolbar";

const options = { groups: [], levels: [], tags: [] };

/** The definition carried by the n-th `router.replace` call. */
function applied(call = 0): Definition {
  const url = new URL(replace.mock.calls[call][0], "http://x");
  const decoded = decodeDraft(url.searchParams.get("d") ?? undefined);
  if (!decoded.ok) throw new Error("undecodable draft");
  return decoded.definition;
}

function setup() {
  render(<ViewToolbar definition={newViewDefinition()} options={options} basePath="/dashboard/tampilan/baru" />);
  return userEvent.setup();
}

/** The first chip's popover trigger (the "Tampilan" menu trigger comes after it). */
const chip = () => document.querySelector<HTMLElement>("[data-slot=popover-trigger]")!;
const popup = () => screen.getByRole("dialog");
/** Ticks a second status ("Keluar" or whichever comes second) in the open editor. */
const tickSecondStatus = (user: ReturnType<typeof userEvent.setup>) => user.click(within(popup()).getAllByRole("checkbox")[1]);

beforeEach(() => replace.mockClear());

describe("Tampilan edits apply on Terapkan or close (task 6.1)", () => {
  it("does not change the result while editing a chip, and applies once on Terapkan", async () => {
    const user = setup();
    await user.click(chip());
    await tickSecondStatus(user);
    expect(replace).not.toHaveBeenCalled();

    await user.click(within(popup()).getByRole("button", { name: "Terapkan" }));
    expect(replace).toHaveBeenCalledTimes(1);
    expect((applied().filter.groups[0].rules[0].value as string[]).length).toBe(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("applies the edit when the chip popover closes with Escape", async () => {
    const user = setup();
    await user.click(chip());
    await tickSecondStatus(user);
    await user.keyboard("{Escape}");
    expect(replace).toHaveBeenCalledTimes(1);
    expect((applied().filter.groups[0].rules[0].value as string[]).length).toBe(2);
  });

  it("does not navigate when a panel closes without edits", async () => {
    const user = setup();
    await user.click(chip());
    await user.keyboard("{Escape}");
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps text still being typed when Terapkan is pressed", async () => {
    const user = setup();
    await user.click(chip());
    await user.selectOptions(within(popup()).getByRole("combobox", { name: "Kolom" }), "Nama");
    await user.type(within(popup()).getByRole("textbox", { name: "Nama" }), "Ahmad");
    await user.click(within(popup()).getByRole("button", { name: "Terapkan" }));
    expect(applied().filter.groups[0].rules[0]).toMatchObject({ field: "name", value: "Ahmad" });
  });

  it("keeps text still being typed when the popover closes with Escape", async () => {
    const user = setup();
    await user.click(chip());
    await user.selectOptions(within(popup()).getByRole("combobox", { name: "Kolom" }), "Nama");
    await user.type(within(popup()).getByRole("textbox", { name: "Nama" }), "Ahmad");
    await user.keyboard("{Escape}");
    expect(applied().filter.groups[0].rules[0]).toMatchObject({ field: "name", value: "Ahmad" });
  });

  it("removes a chip at once with its remove button", async () => {
    const user = setup();
    await user.click(screen.getAllByRole("button", { name: "Hapus filter" })[0]);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(applied().filter.groups).toEqual([]);
  });

  it("removes the filter and closes the popover with Hapus filter inside it", async () => {
    const user = setup();
    await user.click(chip());
    await user.click(within(popup()).getByRole("button", { name: "Hapus filter" }));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(applied().filter.groups).toEqual([]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("applies a new filter from Tambah filter only when its popover is applied", async () => {
    const user = setup();
    await user.click(screen.getAllByRole("button", { name: "Tambah filter" })[0]);
    expect(replace).not.toHaveBeenCalled();
    await user.click(within(popup()).getByRole("button", { name: "Terapkan" }));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(applied().filter.groups).toHaveLength(2);
  });

  it("applies phone sheet edits only on Terapkan, then closes the sheet", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Filter (1)" }));
    await tickSecondStatus(user);
    await user.click(within(popup()).getByRole("button", { name: "Tambah filter" }));
    expect(replace).not.toHaveBeenCalled();

    await user.click(within(popup()).getByRole("button", { name: "Terapkan" }));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(applied().filter.groups).toHaveLength(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
