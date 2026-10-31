// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";
import { MAX_TAG_FILTER_IDS } from "@/lib/constants";
import type { TagOwnerGroup } from "@/lib/tag/list";

import { TagFilter } from "./tag-filter";

const tag = (id: number, groupId: number, key: string, value: string | null = null) => ({ id, groupId, key, value, color: "blue" });

const visible: TagOwnerGroup[] = [
  { group: { id: 3, name: "Kelompok Melati", isOwn: true }, tags: [tag(1, 3, "fokus"), tag(2, 3, "prioritas", "tinggi"), tag(3, 3, "prioritas", "rendah")] },
  { group: { id: 1, name: "Desa Sukamaju", isOwn: false }, tags: [tag(4, 1, "binaan")] },
];

/** Renders the filter inside a form like `FilterBar` does, and records what the form would submit. */
function setup(selected: number[] = [], tags: TagOwnerGroup[] = visible) {
  const submitted: string[] = [];
  const view = render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted.push(String(new FormData(event.currentTarget).get("tag") ?? ""));
      }}
    >
      <TagFilter tags={tags} selected={selected} />
    </form>,
  );
  return { submitted, ...view };
}

const hiddenValue = (container: HTMLElement) => (container.querySelector('input[name="tag"]') as HTMLInputElement).value;

describe("TagFilter (task 5.6)", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("labels the trigger by what is selected", () => {
    const { unmount } = setup([]);
    expect(screen.getByRole("button", { name: /^Tag/ })).toHaveTextContent("Tag");
    unmount();
    const one = setup([2]);
    expect(screen.getByRole("button", { name: /prioritas:tinggi/ })).toBeInTheDocument();
    one.unmount();
    setup([1, 2, 4]);
    expect(screen.getByRole("button", { name: /fokus \+2/ })).toBeInTheDocument();
  });

  it("carries the current selection in a hidden field so other filters keep it", () => {
    const { container } = setup([1, 4]);
    expect(hiddenValue(container)).toBe("1,4");
  });

  it("lists the visible tags under their owner, labelling the user's own group", async () => {
    setup();
    await userEvent.setup().click(screen.getByRole("button", { name: /^Tag/ }));
    expect(screen.getByText("Grup sendiri")).toBeInTheDocument();
    expect(screen.getByText("Desa Sukamaju")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /prioritas:rendah/ })).toBeInTheDocument();
  });

  it("searches by key and key:value", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Tag/ }));
    await user.type(screen.getByRole("combobox"), "prioritas:t");
    expect(screen.getByRole("option", { name: /prioritas:tinggi/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /fokus/ })).not.toBeInTheDocument();
  });

  it("submits the chosen ids only when Terapkan is pressed", async () => {
    const { submitted } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Tag/ }));
    await user.click(screen.getByRole("option", { name: /fokus/ }));
    await user.click(screen.getByRole("option", { name: /binaan/ }));
    expect(submitted).toEqual([]);
    expect(screen.getByText("2 dipilih")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Terapkan" }));
    expect(submitted).toEqual(["1,4"]);
  });

  it("toggles a tag off again and clears everything with Kosongkan", async () => {
    const { submitted } = setup([1, 4]);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /fokus \+1/ }));
    await user.click(screen.getByRole("option", { name: /fokus/ }));
    expect(screen.getByText("1 dipilih")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Kosongkan" }));
    await user.click(screen.getByRole("button", { name: "Terapkan" }));
    expect(submitted).toEqual([""]);
  });

  it("stops offering more tags at MAX_TAG_FILTER_IDS", async () => {
    const many: TagOwnerGroup[] = [
      {
        group: { id: 3, name: "Kelompok Melati", isOwn: true },
        tags: Array.from({ length: MAX_TAG_FILTER_IDS + 1 }, (_, i) => tag(i + 1, 3, `t${String(i).padStart(2, "0")}`)),
      },
    ];
    setup(Array.from({ length: MAX_TAG_FILTER_IDS }, (_, i) => i + 1), many);
    await userEvent.setup().click(screen.getByRole("button", { name: /^t00/ }));
    expect(screen.getByRole("option", { name: /t50/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("uses touch-size controls below xl: 44px items and 16px search text", async () => {
    setup();
    await userEvent.setup().click(screen.getByRole("button", { name: /^Tag/ }));
    expect(screen.getByRole("option", { name: /fokus/ }).className).toContain("min-h-11");
    const input = screen.getByRole("combobox");
    expect(input.className).toContain("h-11");
    expect(input.className).toContain("text-base");
    expect(screen.getByRole("button", { name: "Terapkan" }).className).toContain("h-11");
  });
});
