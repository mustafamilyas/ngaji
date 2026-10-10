import { describe, expect, it } from "vitest";
import { toCreatedUserDto, toUserDto } from "./dto";

const row = {
  id: 7,
  username: "budi",
  name: "Budi",
  passwordHash: "$2b$12$secret",
  isActive: true,
  mustChangePassword: true,
  sessionVersion: 3,
  createdAt: new Date("2026-10-10T00:00:00Z"),
  updatedAt: new Date("2026-10-10T00:00:00Z"),
};

describe("lib/user/dto", () => {
  it("keeps only the fields the UI displays", () => {
    expect(toUserDto(row)).toEqual({
      id: 7,
      username: "budi",
      name: "Budi",
      isActive: true,
      mustChangePassword: true,
    });
  });

  it("never carries the password hash or session version", () => {
    const keys = Object.keys(toUserDto(row));
    expect(keys.some((key) => key.startsWith("password"))).toBe(false);
    expect(keys).not.toContain("sessionVersion");
  });

  it("adds role and group for a freshly created user", () => {
    expect(toCreatedUserDto(row, { role: "ADMIN", groupId: 4 })).toEqual({
      id: 7,
      username: "budi",
      name: "Budi",
      isActive: true,
      mustChangePassword: true,
      role: "ADMIN",
      groupId: 4,
    });
  });
});
