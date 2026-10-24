import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import ActivityListPage from "./page";

async function render(name: string, params: Record<string, string> = {}) {
  const fixture = await buildPageFixture(name);
  mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.leaf) });
  return renderToStaticMarkup(await ActivityListPage({ searchParams: Promise.resolve(params) }));
}

/** Class attribute of the first tag matching `tagPattern`. */
function classOf(html: string, tagPattern: RegExp): string {
  const tag = html.match(tagPattern)?.[0] ?? "";
  return tag.match(/class="([^"]*)"/)?.[1] ?? "";
}

describe("ActivityListPage toolbar phone and tablet sizes", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("makes the Cetak and Kegiatan baru buttons 44px below xl", async () => {
    const html = await render("kegiatan-toolbar-actions");

    expect(classOf(html, /<a[^>]*href="\/dashboard\/kegiatan\/cetak[^"]*"[^>]*>/)).toMatch(/\bh-11\b.*\bxl:h-9\b/);
    expect(classOf(html, /<a[^>]*href="\/dashboard\/kegiatan\/baru"[^>]*>/)).toMatch(/\bh-11\b.*\bxl:h-9\b/);
  });

  it("makes the Daftar and Kalender toggle links 44px below xl", async () => {
    const html = await render("kegiatan-toolbar-toggle");

    for (const view of ["list", "calendar"]) {
      expect(classOf(html, new RegExp(`<a[^>]*href="[^"]*view=${view}[^"]*"[^>]*>`)), view).toMatch(/\bmin-h-11\b/);
    }
  });

  it("makes the search, group and date-range triggers and arrows 44px below xl", async () => {
    const html = await render("kegiatan-toolbar-filters");

    expect(classOf(html, /<input[^>]*type="search"[^>]*>/)).toMatch(/\bh-11\b.*\btext-base\b/);
    for (const label of ["Rentang sebelumnya", "Rentang berikutnya"]) {
      const cls = classOf(html, new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`));
      expect(cls, label).toMatch(/\bh-11\b/);
      expect(cls, label).toMatch(/\bmin-w-11\b/);
    }
  });

  it("makes the activity name link in each row 44px tall below xl", async () => {
    const html = await render("kegiatan-toolbar-row-link", { range: "bulan" });

    expect(classOf(html, /<a[^>]*href="\/dashboard\/kegiatan\/\d+"[^>]*>(?=Kegiatan|[A-Z])/)).toMatch(/\bmin-h-11\b/);
  });
});
