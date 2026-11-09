import { describe, expect, it } from "vitest";
import { interestWhatsappText, interestWhatsappUrl } from "./whatsapp-text";

const lead = { name: "Budi", organizationName: "Majelis An-Nur", memberCount: 40, message: "Mohon info harga" };

describe("interestWhatsappText", () => {
  it("includes name, organization, member count and message", () => {
    const text = interestWhatsappText(lead);
    expect(text).toContain("Budi");
    expect(text).toContain("Majelis An-Nur");
    expect(text).toContain("40");
    expect(text).toContain("Mohon info harga");
  });

  it("omits the member count and message lines when absent", () => {
    const text = interestWhatsappText({ name: "Budi", organizationName: "Majelis An-Nur" });
    expect(text).toContain("Budi");
    expect(text).not.toMatch(/anggota/i);
    expect(text).not.toMatch(/pesan/i);
  });
});

describe("interestWhatsappUrl", () => {
  it("builds a wa.me URL with the normalized number and URL-encoded text", () => {
    const url = interestWhatsappUrl("0812-3456-7890", lead);
    expect(url).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    const text = new URL(url!).searchParams.get("text");
    expect(text).toBe(interestWhatsappText(lead));
  });

  it("round-trips characters that need encoding", () => {
    const tricky = { ...lead, message: "A&B=C?\n#1 100% 😀" };
    const text = new URL(interestWhatsappUrl("0812-3456-7890", tricky)!).searchParams.get("text");
    expect(text).toContain("A&B=C?\n#1 100% 😀");
  });

  it("returns null when the destination number is missing or invalid", () => {
    expect(interestWhatsappUrl(undefined, lead)).toBeNull();
    expect(interestWhatsappUrl("", lead)).toBeNull();
    expect(interestWhatsappUrl("abc", lead)).toBeNull();
  });
});
