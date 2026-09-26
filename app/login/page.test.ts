import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// login-form.tsx pulls in a server action that imports "@/auth" and
// "next-auth" directly; the real next-auth module chain doesn't resolve
// outside a Next.js build, so both are mocked here just to avoid importing it.
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));

import LoginPage from "./page";

describe("LoginPage", () => {
  it("renders without crashing", () => {
    const html = renderToStaticMarkup(LoginPage());
    expect(html).toContain("Masuk");
  });
});
