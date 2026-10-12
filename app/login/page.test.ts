import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// login-form.tsx pulls in a server action that imports "@/auth" and
// "next-auth" directly; the real next-auth module chain doesn't resolve
// outside a Next.js build, so both are mocked here just to avoid importing it.
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("@/lib/organization", () => ({ getOrganizationName: vi.fn() }));

import { getOrganizationName } from "@/lib/organization";
import LoginPage from "./page";

async function render(pesan?: string) {
  return renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({ pesan }) }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.mocked(getOrganizationName).mockReset();
    vi.mocked(getOrganizationName).mockResolvedValue("Dahan");
  });

  it("renders without crashing", async () => {
    expect(await render()).toContain("Masuk");
  });

  it("shows the password-changed banner after a password change", async () => {
    expect(await render("password-diubah")).toContain("Password berhasil diubah, silakan masuk lagi");
  });

  it("ignores unknown pesan values", async () => {
    expect(await render("<script>")).not.toContain("silakan masuk lagi");
  });

  it("shows the organization name and the Dahan mark above the form", async () => {
    vi.mocked(getOrganizationName).mockResolvedValue("Pengajian Al-Ikhlas");
    const html = await render();
    expect(html).toContain("Pengajian Al-Ikhlas");
    expect(html).toContain("oleh Dahan");
    expect(html).not.toContain("Ngaji");
  });

  it("falls back to Dahan when the deployment has no organization yet", async () => {
    const html = await render();
    expect(html).toContain("oleh Dahan");
    expect(html).toContain("Masuk");
  });
});
