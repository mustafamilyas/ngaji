// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/lib/test/dom";
import type { TagOwnerGroup } from "@/lib/tag/list";

const actions = vi.hoisted(() => ({
  attachTagAction: vi.fn(),
  detachTagAction: vi.fn(),
  createAndAttachTagAction: vi.fn(),
}));
vi.mock("@/app/dashboard/tag/actions", () => actions);

import { TagPicker } from "./tag-picker";
import { TagOptionsProvider } from "./tag-options-context";

const tag = (id: number, groupId: number, key: string, value: string | null = null, color = "blue") => ({
  id,
  groupId,
  key,
  value,
  color,
});

const options: TagOwnerGroup[] = [
  { group: { id: 3, name: "Kelompok Melati", isOwn: true }, tags: [tag(1, 3, "fokus"), tag(2, 3, "prioritas", "tinggi", "red"), tag(3, 3, "prioritas", "rendah", "green")] },
  { group: { id: 1, name: "Desa Sukamaju", isOwn: false }, tags: [tag(4, 1, "binaan")] },
];

const target = { kind: "member", id: 10 } as const;

function setup(props: Partial<React.ComponentProps<typeof TagPicker>> = {}) {
  return render(<TagPicker target={target} attached={[]} options={options} canCreate={false} {...props} />);
}

/** jsdom has no layout engine or media queries; cmdk needs these to mount. */
function stubBrowser(wide: boolean) {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

async function openPicker() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Atur tag" }));
  return user;
}

describe("TagPicker (task 5.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowser(true);
    actions.attachTagAction.mockResolvedValue({ ok: true, data: { changed: true, replacedTagIds: [] } });
    actions.detachTagAction.mockResolvedValue({ ok: true, data: { changed: true } });
  });

  it("lists usable tags under their owner, labelling the user's own group", async () => {
    setup();
    await openPicker();
    expect(screen.getByText("Grup sendiri")).toBeInTheDocument();
    expect(screen.getByText("Desa Sukamaju")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /prioritas:tinggi/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /binaan/ })).toBeInTheDocument();
  });

  it("searches by key and by key:value", async () => {
    setup();
    const user = await openPicker();
    await user.type(screen.getByRole("combobox"), "prioritas:r");
    expect(screen.getByRole("option", { name: /prioritas:rendah/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /prioritas:tinggi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /fokus/ })).not.toBeInTheDocument();
  });

  it("attaches an unattached tag and shows its chip before the server answers", async () => {
    let resolve!: (v: unknown) => void;
    actions.attachTagAction.mockReturnValue(new Promise((r) => (resolve = r)));
    setup();
    const user = await openPicker();
    await user.click(screen.getByRole("option", { name: /fokus/ }));

    expect(actions.attachTagAction).toHaveBeenCalledWith({ kind: "member", id: 10, tagId: 1 });
    expect(await screen.findByRole("button", { name: "Hapus tag fokus" })).toBeInTheDocument();
    resolve({ ok: true, data: { changed: true, replacedTagIds: [] } });
  });

  it("replaces the chip of the same key when another value is attached", async () => {
    let resolve!: (v: unknown) => void;
    actions.attachTagAction.mockReturnValue(new Promise((r) => (resolve = r)));
    setup({ attached: [tag(2, 3, "prioritas", "tinggi", "red")] });
    const user = await openPicker();
    await user.click(screen.getByRole("option", { name: /prioritas:rendah/ }));

    expect(await screen.findByRole("button", { name: "Hapus tag prioritas:rendah" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hapus tag prioritas:tinggi" })).not.toBeInTheDocument();
    resolve({ ok: true, data: { changed: true, replacedTagIds: [2] } });
  });

  it("detaches when an attached tag is chosen again", async () => {
    setup({ attached: [tag(1, 3, "fokus")] });
    const user = await openPicker();
    await user.click(screen.getByRole("option", { name: /fokus/ }));
    expect(actions.detachTagAction).toHaveBeenCalledWith({ kind: "member", id: 10, tagId: 1 });
  });

  it("detaches from the chip's remove button", async () => {
    setup({ attached: [tag(1, 3, "fokus")] });
    await userEvent.setup().click(screen.getByRole("button", { name: "Hapus tag fokus" }));
    expect(actions.detachTagAction).toHaveBeenCalledWith({ kind: "member", id: 10, tagId: 1 });
  });

  it("shows a tag the user cannot use as a chip without a remove button (task 8.5)", () => {
    setup({ attached: [tag(1, 3, "fokus"), tag(77, 99, "binaan-desa-bawah")] });
    expect(screen.getByRole("button", { name: "Hapus tag fokus" })).toBeInTheDocument();
    expect(screen.getByText("binaan-desa-bawah")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hapus tag binaan-desa-bawah" })).not.toBeInTheDocument();
  });

  describe("focus on open (task 8.3)", () => {
    it("puts the cursor in the search field when the popover is opened with the mouse", async () => {
      setup();
      await openPicker();
      await waitFor(() => expect(screen.getByRole("combobox")).toHaveFocus());
    });

    it("puts the cursor in the search field when the sheet is opened with the mouse", async () => {
      stubBrowser(false);
      setup();
      await openPicker();
      await waitFor(() => expect(screen.getByRole("combobox")).toHaveFocus());
    });

    it("leaves the search field unfocused when the sheet is opened by touch, so the keyboard does not cover the list", async () => {
      stubBrowser(false);
      setup();
      const user = userEvent.setup();
      await user.pointer({ keys: "[TouchA]", target: screen.getByRole("button", { name: "Atur tag" }) });
      expect(await screen.findByRole("dialog", { name: "Atur tag" })).toBeInTheDocument();
      expect(screen.getByRole("combobox")).not.toHaveFocus();
    });
  });

  describe("keyboard and screen readers (task 7.5)", () => {
    for (const [mode, wide] of [["popover", true], ["sheet", false]] as const) {
      it(`reports expanded state and returns focus to the trigger on Escape (${mode})`, async () => {
        stubBrowser(wide);
        setup();
        const trigger = screen.getByRole("button", { name: "Atur tag" });
        expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
        expect(trigger).toHaveAttribute("aria-expanded", "false");

        await openPicker();
        await waitFor(() => expect(screen.getByRole("combobox")).toHaveFocus());
        expect(trigger).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByRole("listbox")).toBeInTheDocument();

        await userEvent.setup().keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
        expect(trigger).toHaveAttribute("aria-expanded", "false");
      });
    }
  });

  describe("empty state (task 8.2)", () => {
    it("tells a user who cannot create tags that there is nothing to choose yet", async () => {
      setup({ options: [], canCreate: false });
      await openPicker();
      expect(screen.getByText("Belum ada tag yang bisa dipakai.")).toBeInTheDocument();
    });

    it("tells an admin to type a name to create the first tag", async () => {
      setup({ options: [], canCreate: true });
      await openPicker();
      expect(screen.getByText("Belum ada tag. Ketik nama untuk membuat tag.")).toBeInTheDocument();
    });

    it("keeps 'Tidak ditemukan.' for a search that matches nothing among existing tags", async () => {
      setup({ canCreate: false });
      const user = await openPicker();
      await user.type(screen.getByRole("combobox"), "zzz");
      expect(screen.getByText("Tidak ditemukan.")).toBeInTheDocument();
      expect(screen.queryByText(/Belum ada tag/)).not.toBeInTheDocument();
    });
  });

  it("rolls the chip back and shows the server's message when the action fails", async () => {
    actions.attachTagAction.mockResolvedValue({ ok: false, error: "Satu data maksimal memiliki 20 tag" });
    setup();
    const user = await openPicker();
    await user.click(screen.getByRole("option", { name: /fokus/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Satu data maksimal memiliki 20 tag");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Hapus tag fokus" })).not.toBeInTheDocument());
  });

  it("offers no create option to a user who may not create tags", async () => {
    setup({ canCreate: false });
    const user = await openPicker();
    await user.type(screen.getByRole("combobox"), "baru");
    expect(screen.queryByRole("option", { name: /Buat tag/ })).not.toBeInTheDocument();
    expect(screen.getByText("Tidak ditemukan.")).toBeInTheDocument();
  });

  it("lets an admin create and attach a tag from the typed text", async () => {
    actions.createAndAttachTagAction.mockResolvedValue({
      ok: true,
      data: { tag: tag(9, 3, "baru", "ya", "slate"), changed: true, replacedTagIds: [] },
    });
    setup({ canCreate: true });
    const user = await openPicker();
    await user.type(screen.getByRole("combobox"), "Baru:Ya");
    await user.click(screen.getByRole("option", { name: /Buat tag.*baru:ya/ }));

    expect(actions.createAndAttachTagAction).toHaveBeenCalledWith({ kind: "member", id: 10, name: "Baru:Ya" });
  });

  it("does not offer to create a tag that already exists", async () => {
    setup({ canCreate: true });
    const user = await openPicker();
    await user.type(screen.getByRole("combobox"), "FOKUS");
    expect(screen.queryByRole("option", { name: /Buat tag/ })).not.toBeInTheDocument();
  });

  it("does not offer to create a name that fails the naming rules", async () => {
    setup({ canCreate: true });
    const user = await openPicker();
    await user.type(screen.getByRole("combobox"), "a:b:c");
    expect(screen.queryByRole("option", { name: /Buat tag/ })).not.toBeInTheDocument();
  });

  it("opens in a bottom sheet below xl and in a popover from xl (task 5.2a)", async () => {
    stubBrowser(false);
    const { unmount } = setup();
    await openPicker();
    expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeNull();
    unmount();

    stubBrowser(true);
    setup();
    await openPicker();
    expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();
  });

  it("gives the sheet a title for screen readers and 44px, 16px controls", async () => {
    stubBrowser(false);
    setup({ canCreate: true });
    const user = await openPicker();
    expect(screen.getByRole("dialog", { name: "Atur tag" })).toBeInTheDocument();
    const input = screen.getByRole("combobox");
    expect(input.className).toContain("h-11");
    expect(input.className).toContain("text-base");
    await user.type(input, "baru");
    expect(screen.getByRole("option", { name: /Buat tag/ }).className).toContain("min-h-11");
  });

  describe("in a table row (task 5.4)", () => {
    it("keeps chips read-only and opens the picker from a labelled '+' trigger", async () => {
      setup({ attached: [tag(1, 3, "fokus")], compact: true, label: "Ahmad Fauzi" });
      expect(screen.getByText("fokus")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Hapus tag/ })).not.toBeInTheDocument();

      await userEvent.setup().click(screen.getByRole("button", { name: "Atur tag Ahmad Fauzi" }));
      expect(screen.getByRole("option", { name: /prioritas:tinggi/ })).toBeInTheDocument();
    });

    it("removes a tag by choosing it again in the list", async () => {
      setup({ attached: [tag(1, 3, "fokus")], compact: true, label: "Ahmad Fauzi" });
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Atur tag Ahmad Fauzi" }));
      await user.click(screen.getByRole("option", { name: /fokus/ }));
      expect(actions.detachTagAction).toHaveBeenCalledWith({ kind: "member", id: 10, tagId: 1 });
    });

    it("shows a visible 'Tag' label on the trigger of a row that has no tags yet (task 8.9)", () => {
      setup({ attached: [], compact: true, label: "Ahmad Fauzi" });
      const trigger = screen.getByRole("button", { name: "Atur tag Ahmad Fauzi" });
      expect(trigger).toHaveTextContent("Tag");
      expect(trigger.className).toMatch(/h-11/);
    });

    it("keeps the bare '+' once the row has chips, so the chips stay the focus (task 8.9)", () => {
      setup({ attached: [tag(1, 3, "fokus")], compact: true, label: "Ahmad Fauzi" });
      expect(screen.getByRole("button", { name: "Atur tag Ahmad Fauzi" })).not.toHaveTextContent("Tag");
    });

    it("gives the trigger a 44px touch target below xl", () => {
      setup({ compact: true, label: "Ahmad Fauzi" });
      const trigger = screen.getByRole("button", { name: "Atur tag Ahmad Fauzi" });
      expect(trigger.className).toMatch(/size-11|h-11/);
    });

    it("gives the bare '+' trigger of a row with chips a 44px touch target too", () => {
      setup({ attached: [tag(1, 3, "fokus")], compact: true, label: "Ahmad Fauzi" });
      expect(screen.getByRole("button", { name: "Atur tag Ahmad Fauzi" }).className).toMatch(/size-11/);
    });

    it("reads options and create right from the page's provider when it gets no props for them", async () => {
      render(
        <TagOptionsProvider options={options} canCreate>
          <TagPicker target={target} attached={[]} compact label="Ahmad Fauzi" />
        </TagOptionsProvider>,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Atur tag Ahmad Fauzi" }));
      expect(screen.getByRole("option", { name: /binaan/ })).toBeInTheDocument();
      await user.type(screen.getByRole("combobox"), "baru");
      expect(screen.getByRole("option", { name: /Buat tag/ })).toBeInTheDocument();
    });
  });
});
