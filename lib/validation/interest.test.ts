import { describe, expect, it } from "vitest";
import { INTEREST_MAX_FIELD_LENGTH, INTEREST_MAX_MEMBER_COUNT, INTEREST_MAX_MESSAGE_LENGTH } from "@/lib/constants";
import { interestSchema } from "./interest";

const valid = {
  name: "Budi",
  phone: "0812-3456-7890",
  organizationName: "Majelis An-Nur",
  consent: true,
};

describe("interestSchema", () => {
  it("accepts the required fields and trims text", () => {
    const parsed = interestSchema.parse({ ...valid, name: "  Budi  ", organizationName: " Majelis An-Nur " });
    expect(parsed).toMatchObject({ name: "Budi", organizationName: "Majelis An-Nur", phone: "0812-3456-7890" });
    expect(parsed.memberCount).toBeUndefined();
    expect(parsed.message).toBeUndefined();
  });

  it("requires consent", () => {
    expect(interestSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(interestSchema.safeParse({ ...valid, consent: undefined }).success).toBe(false);
  });

  it("rejects an unusable WhatsApp number", () => {
    for (const phone of ["abc", "", "   ", "123", "+1"]) {
      expect(interestSchema.safeParse({ ...valid, phone }).success, phone).toBe(false);
    }
  });

  it("accepts the Indonesian number forms the member links accept", () => {
    for (const phone of ["08123456789", "+62 812 3456 7890", "6281234567890"]) {
      expect(interestSchema.safeParse({ ...valid, phone }).success, phone).toBe(true);
    }
  });

  it("rejects an empty or whitespace-only name and organization name", () => {
    expect(interestSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(interestSchema.safeParse({ ...valid, organizationName: "" }).success).toBe(false);
  });

  it("rejects over-long fields", () => {
    const long = "x".repeat(INTEREST_MAX_FIELD_LENGTH + 1);
    expect(interestSchema.safeParse({ ...valid, name: long }).success).toBe(false);
    expect(interestSchema.safeParse({ ...valid, organizationName: long }).success).toBe(false);
    expect(
      interestSchema.safeParse({ ...valid, message: "x".repeat(INTEREST_MAX_MESSAGE_LENGTH + 1) }).success,
    ).toBe(false);
  });

  it("treats empty optional fields as absent", () => {
    const parsed = interestSchema.parse({ ...valid, memberCount: "", message: "  " });
    expect(parsed.memberCount).toBeUndefined();
    expect(parsed.message).toBeUndefined();
  });

  it("accepts a member count as number or numeric string, whole and within bounds", () => {
    expect(interestSchema.parse({ ...valid, memberCount: 40 }).memberCount).toBe(40);
    expect(interestSchema.parse({ ...valid, memberCount: "40" }).memberCount).toBe(40);
    for (const memberCount of [0, -1, 1.5, "abc", "1.5", INTEREST_MAX_MEMBER_COUNT + 1]) {
      expect(interestSchema.safeParse({ ...valid, memberCount }).success, String(memberCount)).toBe(false);
    }
  });

  it("allows the honeypot field to be present so the action can inspect it", () => {
    expect(interestSchema.parse({ ...valid, website: "spam" }).website).toBe("spam");
  });
});
