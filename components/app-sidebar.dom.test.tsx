// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@/lib/test/dom";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/app/dashboard/actions", () => ({ signOutAction: vi.fn() }));

import { SidebarNav } from "./app-sidebar";

/** jsdom has no layout: give the menu list a size and let a test fire the resize observer. */
let observed: (() => void)[] = [];
const size = { scrollHeight: 460, clientHeight: 209 };

describe("SidebarNav scroll fade (task 11.44)", () => {
  beforeEach(() => {
    observed = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private callback: () => void) {}
        observe() {
          observed.push(this.callback);
          this.callback(); // a real observer reports once when it starts observing
        }
        disconnect() {}
        unobserve() {}
      },
    );
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => size.scrollHeight });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => size.clientHeight });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error restore jsdom's own (zero) layout getters
    delete HTMLElement.prototype.scrollHeight;
    // @ts-expect-error restore jsdom's own (zero) layout getters
    delete HTMLElement.prototype.clientHeight;
  });

  const fade = () => document.querySelector("[data-nav-fade]");
  const menu = () => document.querySelector("[data-nav-scroll]") as HTMLElement;

  it("shows a fade while the menu list can scroll further", () => {
    render(<SidebarNav userName="Budi" userRole="OWNER" />);
    expect(fade()).toBeInTheDocument();
    expect(fade()).toHaveAttribute("aria-hidden", "true");
    expect(fade()).toHaveClass("pointer-events-none");
  });

  it("hides the fade once the list is scrolled to its end, and brings it back when scrolled up", () => {
    render(<SidebarNav userName="Budi" userRole="OWNER" />);

    menu().scrollTop = 251;
    act(() => {
      menu().dispatchEvent(new Event("scroll"));
    });
    expect(fade()).not.toBeInTheDocument();

    menu().scrollTop = 0;
    act(() => {
      menu().dispatchEvent(new Event("scroll"));
    });
    expect(fade()).toBeInTheDocument();
  });

  it("has no fade when the whole list fits", () => {
    size.scrollHeight = 440;
    size.clientHeight = 440;
    render(<SidebarNav userName="Budi" userRole="OWNER" />);
    expect(fade()).not.toBeInTheDocument();
    size.scrollHeight = 460;
    size.clientHeight = 209;
  });

  it("re-checks when the list is resized (a phone rotated)", () => {
    size.scrollHeight = 440;
    size.clientHeight = 440;
    render(<SidebarNav userName="Budi" userRole="OWNER" />);
    expect(fade()).not.toBeInTheDocument();

    size.clientHeight = 209;
    act(() => observed.forEach((callback) => callback()));

    expect(fade()).toBeInTheDocument();
    size.scrollHeight = 460;
  });

  it("keeps Akun and Keluar outside the scrolling, faded part", () => {
    render(<SidebarNav userName="Budi" userRole="OWNER" />);
    expect(menu()).not.toContainElement(screen.getByRole("button", { name: "Keluar" }));
  });
});
