import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/font/google", () => ({
  Bricolage_Grotesque: () => ({ variable: "", className: "" }),
}));

import { db } from "@/lib/db";
import { buildPageFixture } from "@/lib/test/fixtures";
import PengajianPage from "@/app/pengajian/page";
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

  it("links to the login page and the pengajian page", () => {
    const html = renderGeneric();
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/pengajian"');
  });

  it("shows no pricing", () => {
    expect(renderGeneric().toLowerCase()).not.toContain("harga");
  });

  it("links the WhatsApp CTA to the configured number, opening a new tab safely", () => {
    vi.stubEnv("DAHAN_WHATSAPP", "0812-3456-7890");
    const html = renderGeneric();
    expect(html).toContain('href="https://wa.me/6281234567890"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Hubungi via WhatsApp");
  });

  it("renders without a CTA when no number is configured", () => {
    vi.stubEnv("DAHAN_WHATSAPP", "");
    const html = renderGeneric();
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("Hubungi via WhatsApp");
    expect(html).toContain('href="/login"');
  });

  it("renders without a CTA when the configured number is invalid", () => {
    vi.stubEnv("DAHAN_WHATSAPP", "abc");
    expect(renderGeneric()).not.toContain("wa.me");
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

describe("PengajianPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses pengajian wording", () => {
    const html = renderToStaticMarkup(PengajianPage());
    for (const term of ["jamaah", "pengurus", "pusat", "daerah", "desa", "kelompok", "pengajian rutin"]) {
      expect(html.toLowerCase()).toContain(term);
    }
  });

  it("has the same contact CTA and login link", () => {
    vi.stubEnv("DAHAN_WHATSAPP", "0812-3456-7890");
    const html = renderToStaticMarkup(PengajianPage());
    expect(html).toContain('href="https://wa.me/6281234567890"');
    expect(html).toContain('href="/login"');
  });

  it("sets the page title", async () => {
    const { metadata } = await import("@/app/pengajian/page");
    expect(metadata.title).toBe("Untuk pengajian");
  });
});
