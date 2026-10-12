import { afterEach, describe, expect, it, vi } from "vitest";
import { contactWhatsappUrl } from "./contact";

describe("contactWhatsappUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes a configured Indonesian number", () => {
    vi.stubEnv("DAHAN_WHATSAPP", "0812-3456-7890");
    expect(contactWhatsappUrl()).toBe("https://wa.me/6281234567890");
  });

  it("returns null when not configured", () => {
    vi.stubEnv("DAHAN_WHATSAPP", "");
    expect(contactWhatsappUrl()).toBeNull();
  });

  it("returns null when the variable is unset", () => {
    delete process.env.DAHAN_WHATSAPP;
    expect(contactWhatsappUrl()).toBeNull();
  });

  it("returns null for an invalid number", () => {
    vi.stubEnv("DAHAN_WHATSAPP", "abc");
    expect(contactWhatsappUrl()).toBeNull();
  });
});
