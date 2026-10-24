import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/font/google", () => ({
  Bricolage_Grotesque: () => ({ variable: "", className: "" }),
}));

import { db } from "@/lib/db";
import { buildPageFixture } from "@/lib/test/fixtures";
import OrmasPage from "@/app/ormas/page";
import { LandingPage } from "./landing-page";

function renderGeneric() {
  return renderToStaticMarkup(LandingPage({}));
}

describe("LandingPage (generic)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it("shows the positioning, how-it-works and data-protection sections", () => {
    const html = renderGeneric();
    expect(html).toContain("<h1");
    expect(html).toContain("Cara kerjanya");
    expect(html).toContain("Data anggota dijaga");
  });

  it("links to the login page and the ormas page", () => {
    const html = renderGeneric();
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/ormas"');
  });

  it("shows no pricing", () => {
    expect(renderGeneric().toLowerCase()).not.toContain("harga");
  });

  it("links the contact CTA to /daftar in the hero and the closing section, never straight to wa.me", () => {
    vi.stubEnv("DAHAN_WHATSAPP", "0812-3456-7890");
    const html = renderGeneric();
    expect(html.match(/href="\/daftar"/g)).toHaveLength(2);
    expect(html).toContain("Daftar minat");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("Hubungi via WhatsApp");
  });

  it.each(["", "abc"])("still renders the CTA to /daftar when DAHAN_WHATSAPP is %j", (value) => {
    vi.stubEnv("DAHAN_WHATSAPP", value);
    const html = renderGeneric();
    expect(html.match(/href="\/daftar"/g)).toHaveLength(2);
    expect(html).not.toContain("wa.me");
    expect(html).toContain('href="/login"');
  });

  it("opens /daftar in the same tab", () => {
    expect(renderGeneric()).not.toMatch(/href="\/daftar"[^>]*target="_blank"/);
  });

  it("exposes no organization or group names and makes no database query", async () => {
    const fixture = await buildPageFixture("landing-leak");
    const spies = [
      vi.spyOn(db.organization, "findFirst"),
      vi.spyOn(db.group, "findMany"),
      vi.spyOn(db.member, "findMany"),
    ];
    const html = renderGeneric();
    expect(html).not.toContain(`landing-leak Org`);
    expect(html).not.toContain("Anggota Uji");
    expect(html).not.toContain("Other Leaf");
    expect(fixture.organizationId).toBeGreaterThan(0);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});

describe("OrmasPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses ormas wording", () => {
    const html = renderToStaticMarkup(OrmasPage());
    for (const term of ["ormas", "anggota", "pengurus", "pusat", "wilayah", "daerah", "cabang"]) {
      expect(html.toLowerCase()).toContain(term);
    }
  });

  it("has the same contact CTA to /daftar and login link", () => {
    vi.stubEnv("DAHAN_WHATSAPP", "");
    const html = renderToStaticMarkup(OrmasPage());
    expect(html.match(/href="\/daftar"/g)).toHaveLength(2);
    expect(html).not.toContain("wa.me");
    expect(html).toContain('href="/login"');
  });

  it("sets the page title", async () => {
    const { metadata } = await import("@/app/ormas/page");
    expect(metadata.title).toBe("Untuk ormas");
  });
});
