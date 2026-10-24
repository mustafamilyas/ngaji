import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// change-password-form.tsx pulls in a server action that imports "@/auth",
// whose real module chain (next-auth) doesn't resolve outside a Next.js
// build; mocking it here just avoids importing that chain at all.
vi.mock("@/auth", () => ({ auth: vi.fn(), signOut: vi.fn() }));

import ChangePasswordPage from "./page";

describe("ChangePasswordPage", () => {
  it("renders without crashing", () => {
    const html = renderToStaticMarkup(ChangePasswordPage());
    expect(html).toContain("Ganti Password");
  });

  it("gives the fields and the button 44px tap targets with 16px text below xl", () => {
    const html = renderToStaticMarkup(ChangePasswordPage());
    const classOf = (pattern: RegExp) => (html.match(pattern)?.[0] ?? "").match(/class="([^"]*)"/)?.[1] ?? "";
    for (const field of [/<input[^>]*id="currentPassword"[^>]*>/, /<input[^>]*id="newPassword"[^>]*>/]) {
      expect(classOf(field), String(field)).toMatch(/\bh-11\b.*\btext-base\b|\btext-base\b.*\bh-11\b/);
    }
    expect(classOf(/<button[^>]*type="submit"[^>]*>/)).toMatch(/\bh-11\b/);
  });
});
