import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import { mockAuthSession, sessionFor } from "@/lib/test/fixtures";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import { auth } from "@/auth";
import { requireSession } from "./require-session";

const group = { id: 1, path: "0/", organizationId: 1 };

describe("requireSession", () => {
  beforeEach(() => {
    vi.mocked(auth as unknown as () => unknown).mockReset();
  });

  it("returns the session user", async () => {
    mockAuthSession(auth, { user: sessionFor(1, "ADMIN", group) });
    expect(await requireSession()).toMatchObject({ id: "1", role: "ADMIN" });
  });

  it("redirects to /login without a session", async () => {
    mockAuthSession(auth, null);
    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("refuses while mustChangePassword is set", async () => {
    mockAuthSession(auth, { user: { ...sessionFor(1, "ADMIN", group), mustChangePassword: true } });
    await expect(requireSession()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets the password-change action opt in", async () => {
    mockAuthSession(auth, { user: { ...sessionFor(1, "ADMIN", group), mustChangePassword: true } });
    await expect(requireSession({ allowPasswordChange: true })).resolves.toMatchObject({ id: "1" });
  });
});

function findUseServerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return findUseServerFiles(full);
    if (!/\.tsx?$/.test(entry) || /\.test\./.test(entry)) return [];
    return /^\s*["']use server["']/.test(readFileSync(full, "utf8")) ? [full] : [];
  });
}

describe("server action files", () => {
  const files = findUseServerFiles(path.join(process.cwd(), "app"));

  it("finds the action files", () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  it.each(files.map((f) => [path.relative(process.cwd(), f), f]))(
    "%s never calls auth() directly",
    (_name, file) => {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/\bauth\(\)/);
      expect(source).not.toMatch(/import\s*\{[^}]*\bauth\b[^}]*\}\s*from\s*["']@\/auth["']/);
    },
  );
});
