import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import SurveyListPage from "./page";

async function render(name: string) {
  const fx = await buildPageFixture(name);
  await db.survey.create({ data: { groupId: fx.leaf.id, title: "Survei Tata Letak", createdById: fx.actorId } });
  mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.leaf) });
  return renderToStaticMarkup(await SurveyListPage({ searchParams: Promise.resolve({}) }));
}

/** Class attribute of the first tag matching `tagPattern`. */
function classOf(html: string, tagPattern: RegExp): string {
  const tag = html.match(tagPattern)?.[0] ?? "";
  return tag.match(/class="([^"]*)"/)?.[1] ?? "";
}

describe("SurveyListPage phone and tablet layout", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("lays each survey out as a stacked card below md and as a table row from md, in the same markup", async () => {
    const html = await render("survei-layout-stacked");

    expect(html).toMatch(/<table[^>]*class="[^"]*\bblock\b[^"]*\bmd:table\b/);
    expect(html).toMatch(/<thead[^>]*class="[^"]*\bhidden\b[^"]*\bmd:table-header-group\b/);
    expect(html).toMatch(/<tbody[^>]*class="[^"]*\bblock\b[^"]*\bmd:table-row-group\b/);
    expect(classOf(html, /<tr\b[^>]*class="[^"]*\bgrid\b[^"]*"[^>]*>/)).toContain("md:table-row");
  });

  it("labels the Grup pemilik, Respons and Dibuat columns on the phone card only", async () => {
    const html = await render("survei-layout-labels");

    for (const label of ["Grup pemilik", "Respons", "Dibuat"]) {
      expect(html).toMatch(new RegExp(`<span[^>]*class="[^"]*\\bmd:hidden\\b[^"]*"[^>]*>${label}</span>`));
    }
  });

  it("makes the row menu, the title link and the create button 44px below xl", async () => {
    const html = await render("survei-layout-controls");

    expect(classOf(html, /<button[^>]*aria-label="Aksi untuk Survei Tata Letak"[^>]*>/)).toMatch(/\bsize-11\b.*\bxl:size-8\b/);
    expect(classOf(html, /<a[^>]*href="\/dashboard\/survei\/\d+"[^>]*>(?=Survei Tata Letak)/)).toMatch(/\bmin-h-11\b/);
    expect(classOf(html, /<a[^>]*href="\/dashboard\/survei\/baru"[^>]*>/)).toMatch(/\bh-11\b/);
  });

  it("offers a phone sort select in the filter bar", async () => {
    const html = await render("survei-layout-sort");

    expect(html).toMatch(/<select[^>]*aria-label="Urutkan"[^>]*>/);
  });
});
