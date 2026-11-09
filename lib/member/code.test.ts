import { describe, expect, it } from "vitest";
import { generateMemberCode, normalizeMemberCode } from "./code";

const CODE_SHAPE = /^ANR-[0-9A-HJKMNP-TV-Z]{6}$/;

describe("generateMemberCode", () => {
  it("returns PREFIX-XXXXXX from the Crockford alphabet", () => {
    expect(generateMemberCode("ANR")).toMatch(CODE_SHAPE);
  });

  it("maps each random draw to one alphabet character", () => {
    const draws = [0, 31, 18, 20, 10, 9];
    expect(generateMemberCode("ANR", () => draws.shift()!)).toBe("ANR-0ZJMA9");
  });

  it("draws from all 32 characters", () => {
    const maxes: number[] = [];
    generateMemberCode("ANR", (max) => {
      maxes.push(max);
      return 0;
    });
    expect(maxes).toEqual([32, 32, 32, 32, 32, 32]);
  });
});

describe("normalizeMemberCode", () => {
  it("keeps a canonical code as is", () => {
    expect(normalizeMemberCode("ANR-7K3MQ9")).toBe("ANR-7K3MQ9");
  });

  it("accepts lowercase without a dash", () => {
    expect(normalizeMemberCode("anr7k3mq9")).toBe("ANR-7K3MQ9");
  });

  it("trims and strips inner spaces and dashes", () => {
    expect(normalizeMemberCode("  anr - 7k3 mq9 ")).toBe("ANR-7K3MQ9");
  });

  it("maps O to 0 and I/L to 1 in the random part", () => {
    expect(normalizeMemberCode("ANR-7K3MQO")).toBe("ANR-7K3MQ0");
    expect(normalizeMemberCode("ANR-IL0000")).toBe("ANR-110000");
  });

  it("does not map letters in the prefix", () => {
    expect(normalizeMemberCode("OIL-7K3MQ9")).toBe("OIL-7K3MQ9");
  });

  it("supports 2- and 4-letter prefixes", () => {
    expect(normalizeMemberCode("ab7k3mq9")).toBe("AB-7K3MQ9");
    expect(normalizeMemberCode("abcd-7k3mq9")).toBe("ABCD-7K3MQ9");
  });

  it.each([
    ["empty", ""],
    ["a plain name", "Ahmad"],
    ["too short", "A-7K3MQ9"],
    ["too long", "ABCDE-7K3MQ9"],
    ["digit in prefix", "A1-7K3MQ9"],
    ["U in the random part", "ANR-7K3MQU"],
    ["symbol", "ANR-7K3MQ#"],
  ])("returns null for %s", (_label, input) => {
    expect(normalizeMemberCode(input)).toBeNull();
  });
});
