import { describe, expect, it } from "vitest";
import { memberCodePrefixSchema } from "./organization";

describe("memberCodePrefixSchema", () => {
  it.each(["AN", "ANR", "ANRD"])("accepts %s", (prefix) => {
    expect(memberCodePrefixSchema.parse(prefix)).toBe(prefix);
  });

  it("uppercases and trims the input", () => {
    expect(memberCodePrefixSchema.parse(" anr ")).toBe("ANR");
  });

  it.each([
    ["a digit", "A1"],
    ["too long", "ABCDE"],
    ["too short", "A"],
    ["empty", ""],
    ["a dash", "AN-R"],
    ["a non-ASCII letter", "ÄNR"],
  ])("rejects %s", (_label, prefix) => {
    expect(memberCodePrefixSchema.safeParse(prefix).success).toBe(false);
  });
});
