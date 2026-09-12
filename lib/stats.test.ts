import { describe, expect, it } from "vitest";
import { expected, type ExpectedMember } from "./stats";

function member(overrides: Partial<ExpectedMember> = {}): ExpectedMember {
  return {
    id: 1,
    deletedAt: null,
    joinedAt: "2026-01-01",
    status: "AKTIF",
    exitedAt: null,
    ...overrides,
  };
}

describe("expected", () => {
  it("excludes a member who joined after the occurrence date", () => {
    const members = [member({ id: 1, joinedAt: "2026-09-15" })];
    const result = expected({ effectiveDate: "2026-09-10" }, members);
    expect(result.map((m) => m.id)).not.toContain(1);
  });

  it("includes a member who joined on the occurrence date", () => {
    const members = [member({ id: 1, joinedAt: "2026-09-10" })];
    const result = expected({ effectiveDate: "2026-09-10" }, members);
    expect(result.map((m) => m.id)).toContain(1);
  });

  it("includes a KELUAR member whose exitedAt is after the occurrence date", () => {
    const members = [
      member({ id: 1, status: "KELUAR", exitedAt: "2026-09-20" }),
    ];
    const result = expected({ effectiveDate: "2026-09-10" }, members);
    expect(result.map((m) => m.id)).toContain(1);
  });

  it("excludes a KELUAR member whose exitedAt is on or before the occurrence date", () => {
    const members = [
      member({ id: 1, status: "KELUAR", exitedAt: "2026-09-10" }),
    ];
    const result = expected({ effectiveDate: "2026-09-10" }, members);
    expect(result.map((m) => m.id)).not.toContain(1);
  });

  it("excludes a KELUAR member with no exitedAt on any date", () => {
    const members = [member({ id: 1, status: "KELUAR", exitedAt: null })];
    const result = expected({ effectiveDate: "2026-09-10" }, members);
    expect(result.map((m) => m.id)).not.toContain(1);
  });

  it("excludes a soft-deleted member", () => {
    const members = [member({ id: 1, deletedAt: new Date("2026-01-01") })];
    const result = expected({ effectiveDate: "2026-09-10" }, members);
    expect(result.map((m) => m.id)).not.toContain(1);
  });

  it("includes an AKTIF member with no exitedAt", () => {
    const members = [member({ id: 1, status: "AKTIF" })];
    const result = expected({ effectiveDate: "2026-09-10" }, members);
    expect(result.map((m) => m.id)).toContain(1);
  });
});
