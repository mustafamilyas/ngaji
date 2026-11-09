import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import MembersPage from "./page";

async function render(name: string, searchParams: Record<string, string> = {}) {
  const fixture = await buildPageFixture(name);
  mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
  return renderToStaticMarkup(await MembersPage({ searchParams: Promise.resolve(searchParams) }));
}

/** Class attribute of the first tag matching `tagPattern`. */
function classOf(html: string, tagPattern: RegExp): string {
  const tag = html.match(tagPattern)?.[0] ?? "";
  return tag.match(/class="([^"]*)"/)?.[1] ?? "";
}

describe("MembersPage phone and tablet layout", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("lays each member out as a stacked card below md and as a table row from md, in the same markup", async () => {
    const html = await render("anggota-layout-stacked");

    expect(html).toMatch(/<table[^>]*class="[^"]*\bblock\b[^"]*\bmd:table\b/);
    expect(html).toMatch(/<thead[^>]*class="[^"]*\bhidden\b[^"]*\bmd:table-header-group\b/);
    expect(html).toMatch(/<tbody[^>]*class="[^"]*\bblock\b[^"]*\bmd:table-row-group\b/);
    const row = classOf(html, /<tr\b[^>]*class="[^"]*\bgrid\b[^"]*"[^>]*>/);
    expect(row).toContain("md:table-row");
  });

  it("labels every chosen column on the phone card only", async () => {
    const html = await render("anggota-layout-labels");

    for (const label of ["Grup", "Jenis kelamin", "Tanggal lahir", "Status"]) {
      expect(html).toMatch(new RegExp(`<span[^>]*class="[^"]*\\bmd:hidden\\b[^"]*"[^>]*>${label}</span>`));
    }
  });

  it("makes the row menu, WhatsApp button and name link 44px below xl", async () => {
    const html = await render("anggota-layout-row-controls");

    expect(classOf(html, /<button[^>]*aria-label="Aksi untuk Anggota Uji"[^>]*>/)).toMatch(/\bsize-11\b.*\bxl:size-8\b/);
    expect(classOf(html, /<a[^>]*aria-label="Kirim pesan WhatsApp ke Anggota Uji"[^>]*>/)).toMatch(/\bsize-11\b.*\bxl:size-8\b/);
    expect(classOf(html, /<a[^>]*href="\/dashboard\/anggota\/\d+"[^>]*>(?=<span)/)).toMatch(/\bmin-h-11\b/);
  });

  it("makes the filters, Kolom and Tambah anggota 44px tall with 16px text below xl", async () => {
    const html = await render("anggota-layout-filters", { q: "zzz" });

    const controls = [
      /<input[^>]*type="search"[^>]*>/,
      /<select[^>]*aria-label="Status"[^>]*>/,
      /<button(?=[^>]*>(?:(?!<\/button>).)*Semua grup)[^>]*>/,
      /<button(?=[^>]*>(?:(?!<\/button>).)*Kolom)[^>]*>/,
      /<a[^>]*href="\/dashboard\/anggota\/baru"[^>]*>/,
      /<a[^>]*href="\/dashboard\/anggota"[^>]*>(?=(?:<svg[^>]*>.*?<\/svg>)Reset)/,
    ];
    for (const control of controls) {
      const cls = classOf(html, control);
      expect(cls, String(control)).toMatch(/\bh-11\b/);
    }
    for (const control of controls.slice(0, 2)) {
      expect(classOf(html, control), String(control)).toMatch(/\btext-base\b/);
    }
  });

  it("offers a phone sort select in the filter bar", async () => {
    const html = await render("anggota-layout-sort");

    expect(html).toMatch(/<select[^>]*aria-label="Urutkan"[^>]*>/);
  });

  it("keeps only search inline and puts the other filters, sort and Kolom in the filter panel", async () => {
    const html = await render("anggota-layout-panel");
    // Below lg only primary controls sit before the panel; everything after its marker is behind "Filter".
    const [inline, panel] = html.split("data-filter-panel");

    expect(inline).toMatch(/<input[^>]*type="search"/);
    expect(inline).toMatch(/<button[^>]*aria-expanded="false"[^>]*>.*?Filter<\/button>/);
    expect(panel).toMatch(/<select[^>]*aria-label="Status"/);
    expect(panel).toMatch(/<select[^>]*aria-label="Urutkan"/);
    expect(panel).toContain("Kolom");
  });
});
