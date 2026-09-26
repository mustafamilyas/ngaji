import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// change-password-form.tsx pulls in a server action that imports "@/auth",
// whose real module chain (next-auth) doesn't resolve outside a Next.js
// build; mocking it here just avoids importing that chain at all.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import ChangePasswordPage from "./page";

describe("ChangePasswordPage", () => {
  it("renders without crashing", () => {
    const html = renderToStaticMarkup(ChangePasswordPage());
    expect(html).toContain("Ganti Password");
  });
});
