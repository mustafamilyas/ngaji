import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// login-form.tsx pulls in a server action that imports "@/auth" and
// "next-auth" directly; the real next-auth module chain doesn't resolve
// outside a Next.js build, so both are mocked here just to avoid importing it.
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("@/lib/db", () => ({ db: { organization: { findMany: vi.fn() } } }));

import { db } from "@/lib/db";
import LoginPage, { generateMetadata } from "./page";

function orgs(...names: string[]) {
  vi.mocked(db.organization.findMany).mockResolvedValue(names.map((name) => ({ name })) as never);
}

async function render(pesan?: string) {
  return renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({ pesan }) }));
}

async function title() {
  const metadata = await generateMetadata();
  return (metadata.title as { absolute: string }).absolute;
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.mocked(db.organization.findMany).mockReset();
    orgs("Pengajian Al-Ikhlas");
    vi.stubEnv("LOGIN_SHOW_ORG_NAME", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  describe("LOGIN_SHOW_ORG_NAME", () => {
    it("flag off: shows only the Dahan brand, even with one organization", async () => {
      const html = await render();
      expect(html).not.toContain("Pengajian Al-Ikhlas");
      expect(html).toContain("oleh Dahan");
      expect(await title()).toBe("Masuk · Dahan");
    });

    it("flag on + one organization: shows its name above the form and in the title", async () => {
      vi.stubEnv("LOGIN_SHOW_ORG_NAME", "true");
      const html = await render();
      expect(html).toContain("Pengajian Al-Ikhlas");
      expect(html).toContain("oleh Dahan");
      expect(await title()).toBe("Masuk · Pengajian Al-Ikhlas");
    });

    it("flag on + two organizations: stays generic so it never leaks who else uses the deployment", async () => {
      vi.stubEnv("LOGIN_SHOW_ORG_NAME", "true");
      orgs("Pengajian Al-Ikhlas", "Majelis An-Nur");
      const html = await render();
      expect(html).not.toContain("Pengajian Al-Ikhlas");
      expect(html).not.toContain("Majelis An-Nur");
      expect(await title()).toBe("Masuk · Dahan");
    });

    it("flag on + no organization yet: renders Dahan without error", async () => {
      vi.stubEnv("LOGIN_SHOW_ORG_NAME", "true");
      orgs();
      expect(await render()).toContain("oleh Dahan");
      expect(await title()).toBe("Masuk · Dahan");
    });
  });

  it("gives the fields and the button 44px tap targets with 16px text below xl", async () => {
    const html = await render();
    const classOf = (pattern: RegExp) => (html.match(pattern)?.[0] ?? "").match(/class="([^"]*)"/)?.[1] ?? "";

    for (const field of [/<input[^>]*id="username"[^>]*>/, /<input[^>]*id="password"[^>]*>/]) {
      const cls = classOf(field);
      expect(cls, String(field)).toMatch(/\bh-11\b/);
      expect(cls, String(field)).toMatch(/\btext-base\b/);
    }
    expect(classOf(/<button[^>]*type="submit"[^>]*>/)).toMatch(/\bh-11\b.*\bxl:h-8\b|\bh-11\b.*\bxl:h-9\b/);
  });
});
