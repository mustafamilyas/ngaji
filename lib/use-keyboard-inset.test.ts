import { describe, expect, it } from "vitest";
import { keyboardInset } from "./use-keyboard-inset";

const win = (innerHeight: number, vv: { height: number; offsetTop?: number } | null) =>
  ({ innerHeight, visualViewport: vv && { offsetTop: 0, ...vv } }) as unknown as Window;

describe("keyboardInset", () => {
  it("is 0 without visualViewport", () => {
    expect(keyboardInset(win(812, null))).toBe(0);
  });

  it("is the height the visual viewport lost at the bottom", () => {
    expect(keyboardInset(win(812, { height: 512 }))).toBe(300);
  });

  it("does not count the offset the page was scrolled by", () => {
    expect(keyboardInset(win(812, { height: 512, offsetTop: 100 }))).toBe(200);
  });

  it("ignores small changes such as the browser toolbar", () => {
    expect(keyboardInset(win(812, { height: 760 }))).toBe(0);
  });
});
