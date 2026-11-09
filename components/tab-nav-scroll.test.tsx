// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@/lib/test/dom";
import { TabNav } from "./tab-nav";

const tabs = [
  { key: "a", label: "A" },
  { key: "b", label: "B" },
  { key: "c", label: "Tag" },
];

/** jsdom has no layout: give the nav a 375px window and each tab a 100px slot from the left of the strip. */
function stubLayout(scrollLeftSet: (value: number) => void) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.tagName === "NAV") return { left: 0, right: 375, width: 375, top: 0, bottom: 44, height: 44, x: 0, y: 0, toJSON() {} };
    const index = Number(this.getAttribute("data-index") ?? 0);
    return { left: index * 100, right: index * 100 + 100, width: 100, top: 0, bottom: 44, height: 44, x: index * 100, y: 0, toJSON() {} };
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 375 });
  Object.defineProperty(HTMLElement.prototype, "scrollLeft", { configurable: true, get: () => 0, set: scrollLeftSet });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollLeft;
});

describe("TabNav on a narrow screen (task 8.23)", () => {
  it("scrolls the strip so the active tab is in view", () => {
    const scrolled = vi.fn();
    stubLayout(scrolled);
    // The active tab sits at 500–600px of a 375px window.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.tagName === "NAV") return { left: 0, right: 375, width: 375, top: 0, bottom: 44, height: 44, x: 0, y: 0, toJSON() {} };
      return this.getAttribute("aria-current") === "page"
        ? { left: 500, right: 600, width: 100, top: 0, bottom: 44, height: 44, x: 500, y: 0, toJSON() {} }
        : { left: 0, right: 100, width: 100, top: 0, bottom: 44, height: 44, x: 0, y: 0, toJSON() {} };
    });
    render(<TabNav path="/dashboard/grup/3" tabs={tabs} current="c" defaultTab="a" />);

    expect(scrolled).toHaveBeenCalled();
    const left = scrolled.mock.calls.at(-1)?.[0] as number;
    // Centered when possible: the 500–600 tab ends inside the 375px window after scrolling.
    expect(500 - left).toBeGreaterThanOrEqual(0);
    expect(600 - left).toBeLessThanOrEqual(375);
  });

  it("leaves the strip alone when the active tab is already visible", () => {
    const scrolled = vi.fn();
    stubLayout(scrolled);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.tagName === "NAV") return { left: 0, right: 375, width: 375, top: 0, bottom: 44, height: 44, x: 0, y: 0, toJSON() {} };
      return { left: 10, right: 110, width: 100, top: 0, bottom: 44, height: 44, x: 10, y: 0, toJSON() {} };
    });
    render(<TabNav path="/dashboard/grup/3" tabs={tabs} current="a" defaultTab="a" />);
    expect(scrolled).not.toHaveBeenCalled();
  });
});
