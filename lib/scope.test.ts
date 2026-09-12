import { describe, expect, it } from "vitest";
import { ancestorPathsOf, isAncestorOf, isInScope } from "./scope";

describe("isInScope", () => {
  it("is true for the scope group's own path", () => {
    expect(isInScope("1/5/", "1/5/")).toBe(true);
  });

  it("is true for a descendant path", () => {
    expect(isInScope("1/5/12/", "1/5/")).toBe(true);
  });

  it("is false for an ancestor path", () => {
    expect(isInScope("1/", "1/5/")).toBe(false);
  });

  it("is false for a sibling path that merely shares a numeric prefix", () => {
    expect(isInScope("1/50/", "1/5/")).toBe(false);
  });

  it("is false for an unrelated branch", () => {
    expect(isInScope("2/7/", "1/5/")).toBe(false);
  });
});

describe("isAncestorOf", () => {
  it("is true for a strict ancestor", () => {
    expect(isAncestorOf("1/", "1/5/12/")).toBe(true);
  });

  it("is false for the same path", () => {
    expect(isAncestorOf("1/5/", "1/5/")).toBe(false);
  });

  it("is false for a descendant (wrong direction)", () => {
    expect(isAncestorOf("1/5/12/", "1/5/")).toBe(false);
  });

  it("is false for a path that merely shares a numeric prefix", () => {
    expect(isAncestorOf("1/5/", "1/50/12/")).toBe(false);
  });

  it("is false for an unrelated branch", () => {
    expect(isAncestorOf("2/", "1/5/")).toBe(false);
  });
});

describe("ancestorPathsOf", () => {
  it("returns every prefix path inclusive of the path itself", () => {
    expect(ancestorPathsOf("1/5/12/")).toEqual(["1/", "1/5/", "1/5/12/"]);
  });

  it("returns a single entry for a root path", () => {
    expect(ancestorPathsOf("1/")).toEqual(["1/"]);
  });
});
