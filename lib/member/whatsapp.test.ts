import { describe, expect, it } from "vitest";
import { whatsappNumber, whatsappUrl } from "./whatsapp";

describe("whatsappNumber", () => {
  it("converts a local 08… number to the 62 country code", () => {
    expect(whatsappNumber("0812-3456-7890")).toBe("6281234567890");
  });

  it("accepts +62 and 62 prefixes, ignoring spaces and punctuation", () => {
    expect(whatsappNumber("+62 812 3456 7890")).toBe("6281234567890");
    expect(whatsappNumber("62 (812) 3456.7890")).toBe("6281234567890");
  });

  it("accepts a number written without the leading 0", () => {
    expect(whatsappNumber("81234567890")).toBe("6281234567890");
  });

  it("keeps other countries' numbers written with +", () => {
    expect(whatsappNumber("+60 12-345 6789")).toBe("60123456789");
  });

  it("rejects numbers that cannot be a mobile number", () => {
    expect(whatsappNumber("")).toBeNull();
    expect(whatsappNumber("-")).toBeNull();
    expect(whatsappNumber("12345")).toBeNull();
    expect(whatsappNumber("021 1234 5678 9012 3456")).toBeNull();
    expect(whatsappNumber("5551234567")).toBeNull();
  });
});

describe("whatsappUrl", () => {
  it("builds a wa.me link", () => {
    expect(whatsappUrl("0812 3456 7890")).toBe("https://wa.me/6281234567890");
  });

  it("returns null when the number is unusable", () => {
    expect(whatsappUrl("tidak ada")).toBeNull();
  });
});
