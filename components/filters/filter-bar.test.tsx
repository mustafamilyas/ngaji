// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/lib/test/dom";

import { FilterBar } from "./filter-bar";

// `next/form` needs the app router; a plain form is enough for the panel.
vi.mock("next/form", () => ({
  default: (props: React.ComponentProps<"form"> & { scroll?: boolean }) => {
    const formProps = { ...props };
    delete formProps.scroll;
    return <form {...formProps} />;
  },
}));

function setup({ more = true, activeCount = 0, isFiltered = false } = {}) {
  render(
    <FilterBar
      action="/dashboard/anggota"
      isFiltered={isFiltered}
      resetHref="/dashboard/anggota"
      activeCount={activeCount}
      more={more ? <select name="status" aria-label="Status" /> : undefined}
    >
      <input type="search" name="q" aria-label="Cari" />
    </FilterBar>,
  );
  return userEvent.setup();
}

const filterButton = () => screen.getByRole("button", { name: /^Filter/ });
const panel = () => screen.queryByRole("dialog", { name: "Filter" });

describe("FilterBar panel (task 2.1)", () => {
  it("shows no Filter button when the page has no secondary controls", () => {
    setup({ more: false });
    expect(screen.queryByRole("button", { name: /^Filter/ })).not.toBeInTheDocument();
  });

  it("shows no count when no secondary filter is active", () => {
    setup({ activeCount: 0 });
    expect(filterButton()).toHaveTextContent(/^Filter$/);
  });

  it("shows the active-filter count", () => {
    setup({ activeCount: 2, isFiltered: true });
    expect(filterButton()).toHaveTextContent("Filter (2)");
  });

  it("opens the panel with focus on it and the secondary controls inside", async () => {
    const user = setup();
    expect(panel()).not.toBeInTheDocument();
    await user.click(filterButton());
    expect(panel()).toHaveFocus();
    expect(panel()).toContainElement(screen.getByRole("combobox", { name: "Status" }));
    expect(filterButton()).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the secondary controls inside the filter form", () => {
    setup();
    expect(screen.getByRole("combobox", { name: "Status" }).closest("form")).toBe(screen.getByRole("search"));
  });

  it("closes on Escape and returns focus to the Filter button", async () => {
    const user = setup();
    await user.click(filterButton());
    await user.keyboard("{Escape}");
    expect(panel()).not.toBeInTheDocument();
    expect(filterButton()).toHaveFocus();
  });

  it("closes on a backdrop tap and returns focus to the Filter button", async () => {
    const user = setup();
    await user.click(filterButton());
    await user.click(document.querySelector("[data-filter-backdrop]")!);
    expect(panel()).not.toBeInTheDocument();
    expect(filterButton()).toHaveFocus();
  });

  it("closes on its close button and returns focus to the Filter button", async () => {
    const user = setup();
    await user.click(filterButton());
    await user.click(screen.getByRole("button", { name: "Tutup" }));
    expect(panel()).not.toBeInTheDocument();
    expect(filterButton()).toHaveFocus();
  });

  it("offers Reset in the panel when a secondary filter is active", async () => {
    const user = setup({ activeCount: 1, isFiltered: true });
    await user.click(filterButton());
    expect(panel()).toContainElement(screen.getAllByRole("link", { name: "Reset" }).find((link) => panel()!.contains(link))!);
  });

  it("locks page scroll while open", async () => {
    const user = setup();
    await user.click(filterButton());
    expect(document.documentElement.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(document.documentElement.style.overflow).toBe("");
  });
});
