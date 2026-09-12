import { describe, expect, it } from "vitest";
import { createMemberSchema } from "./member";

function base(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    groupId: 1,
    name: "Anggota Uji",
    birthPlace: "Jakarta",
    birthDate: "2000-01-01",
    sex: "L",
    address: "Jl. Uji No. 1",
    phone: "081200000000",
    maritalStatus: "BELUM_MENIKAH",
    workStatus: "BEKERJA",
    status: "AKTIF",
    joinedAt: "2024-01-01",
    ...overrides,
  };
}

describe("createMemberSchema", () => {
  it("accepts a valid AKTIF member without exitedAt", () => {
    expect(createMemberSchema.safeParse(base()).success).toBe(true);
  });

  it("rejects a missing status", () => {
    const input = base() as Record<string, unknown>;
    delete input.status;
    expect(createMemberSchema.safeParse(input).success).toBe(false);
  });

  it("rejects KELUAR without exitedAt", () => {
    const result = createMemberSchema.safeParse(base({ status: "KELUAR" }));
    expect(result.success).toBe(false);
  });

  it("accepts KELUAR with exitedAt", () => {
    const result = createMemberSchema.safeParse(base({ status: "KELUAR", exitedAt: "2025-01-01" }));
    expect(result.success).toBe(true);
  });

  it("rejects an empty exitedAt string for a non-AKTIF status", () => {
    const result = createMemberSchema.safeParse(base({ status: "MENINGGAL", exitedAt: "" }));
    expect(result.success).toBe(false);
  });

  it("allows a shared phone number (not unique)", () => {
    const first = createMemberSchema.safeParse(base({ phone: "081200000000" }));
    const second = createMemberSchema.safeParse(base({ phone: "081200000000" }));
    expect(first.success && second.success).toBe(true);
  });

  it("rejects an invalid sex value", () => {
    const result = createMemberSchema.safeParse(base({ sex: "X" }));
    expect(result.success).toBe(false);
  });

  it("rejects a malformed birthDate", () => {
    const result = createMemberSchema.safeParse(base({ birthDate: "01-01-2000" }));
    expect(result.success).toBe(false);
  });

  it("treats an empty email as absent rather than invalid", () => {
    const result = createMemberSchema.safeParse(base({ email: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBeUndefined();
  });

  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse(base({ email: "not-an-email" }));
    expect(result.success).toBe(false);
  });
});
