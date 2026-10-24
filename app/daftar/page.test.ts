import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { db } from "@/lib/db";
import DaftarPage, { metadata } from "./page";

describe("DaftarPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("sets the page title", () => {
    expect(metadata.title).toBe("Daftar minat");
  });

  it("renders every field with Indonesian labels and keyboard hints for phones", () => {
    const html = renderToStaticMarkup(DaftarPage());
    for (const label of ["Nama Anda", "Nomor WhatsApp", "Nama organisasi", "Perkiraan jumlah anggota", "Pesan", "Saya setuju data ini dipakai untuk menghubungi saya"]) {
      expect(html).toContain(label);
    }
    expect(html).toMatch(/type="tel"[^>]*autoComplete="tel"|autoComplete="tel"[^>]*type="tel"/);
    expect(html).toMatch(/inputMode="numeric"/);
    expect(html).toContain('href="/login"');
  });

  it("includes a honeypot field that people and assistive tech skip", () => {
    const html = renderToStaticMarkup(DaftarPage());
    expect(html).toMatch(/name="website"/);
    expect(html).toMatch(/tabindex="-1"/);
    expect(html).toMatch(/aria-hidden="true"/);
  });

  it("renders no data from earlier leads and makes no lead query", async () => {
    await db.interestLead.create({
      data: { name: "Lead Rahasia", phone: "6281200000000", organizationName: "Ormas Rahasia", consentAt: new Date() },
    });
    const spy = vi.spyOn(db.interestLead, "findMany");
    const html = renderToStaticMarkup(DaftarPage());
    expect(html).not.toContain("Lead Rahasia");
    expect(html).not.toContain("Ormas Rahasia");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
