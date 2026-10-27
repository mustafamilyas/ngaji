import { describe, expect, it } from "vitest";
import { hasMoreBelow } from "./nav-scroll";

describe("hasMoreBelow", () => {
  it("is true while content remains below the visible part", () => {
    expect(hasMoreBelow({ scrollHeight: 460, scrollTop: 0, clientHeight: 209 })).toBe(true);
    expect(hasMoreBelow({ scrollHeight: 460, scrollTop: 100, clientHeight: 209 })).toBe(true);
  });

  it("is false at the end of the list", () => {
    expect(hasMoreBelow({ scrollHeight: 460, scrollTop: 251, clientHeight: 209 })).toBe(false);
  });

  it("is false when everything fits", () => {
    expect(hasMoreBelow({ scrollHeight: 440, scrollTop: 0, clientHeight: 440 })).toBe(false);
  });

  it("ignores a sub-pixel remainder from fractional scroll positions", () => {
    expect(hasMoreBelow({ scrollHeight: 460, scrollTop: 250.4, clientHeight: 209 })).toBe(false);
  });
});
