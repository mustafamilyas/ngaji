import { describe, expect, it } from "vitest";
import { credentialsSchema } from "./auth";
import { usernameSchema } from "./username";
import { createUserSchema } from "./user";

describe("usernameSchema", () => {
  it("lowercases uppercase letters", () => {
    expect(usernameSchema.parse("Budi.Santoso_1")).toBe("budi.santoso_1");
  });

  it("trims surrounding whitespace before lowercasing", () => {
    expect(usernameSchema.parse("  Budi  ")).toBe("budi");
  });

  it("still rejects too short, too long and illegal characters", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(51)).success).toBe(false);
    expect(usernameSchema.safeParse("bud i").success).toBe(false);
    expect(usernameSchema.safeParse("budi-santoso").success).toBe(false);
  });
});

describe("createUserSchema username", () => {
  it("normalizes the username to lowercase", () => {
    const parsed = createUserSchema.parse({ groupId: 1, username: "Budi", name: "Budi", role: "USER" });
    expect(parsed.username).toBe("budi");
  });
});

describe("credentialsSchema username", () => {
  it("normalizes the username to lowercase so login is case-insensitive", () => {
    const parsed = credentialsSchema.parse({ username: " Admin ", password: "x" });
    expect(parsed.username).toBe("admin");
  });
});
