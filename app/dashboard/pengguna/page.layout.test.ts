import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import UsersPage from "./page";

async function render(name: string, searchParams: Record<string, string> = {}) {
  const fixture = await buildPageFixture(name);
  mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
  await db.userGroupRole.create({ data: { userId: fixture.actorId, groupId: fixture.root.id, role: "OWNER" } });
  const other = await db.user.create({ data: { username: `${name}-other`, passwordHash: "x", name: "Other User" } });
  await db.userGroupRole.create({ data: { userId: other.id, groupId: fixture.leaf.id, role: "ADMIN" } });
  return renderToStaticMarkup(await UsersPage({ searchParams: Promise.resolve(searchParams) }));
}

/** Class attribute of the first tag matching `tagPattern`. */
function classOf(html: string, tagPattern: RegExp): string {
  const tag = html.match(tagPattern)?.[0] ?? "";
  return tag.match(/class="([^"]*)"/)?.[1] ?? "";
}

describe("UsersPage phone and tablet layout", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("lays each user out as a stacked card below md and as a table row from md, in the same markup", async () => {
    const html = await render("pengguna-layout-stacked");

    expect(html).toMatch(/<table[^>]*class="[^"]*\bblock\b[^"]*\bmd:table\b/);
    expect(html).toMatch(/<thead[^>]*class="[^"]*\bhidden\b[^"]*\bmd:table-header-group\b/);
    expect(html).toMatch(/<tbody[^>]*class="[^"]*\bblock\b[^"]*\bmd:table-row-group\b/);
    expect(classOf(html, /<tr\b[^>]*class="[^"]*\bgrid\b[^"]*"[^>]*>/)).toContain("md:table-row");
  });

  it("labels every column on the phone card only", async () => {
    const html = await render("pengguna-layout-labels");

    for (const label of ["Username", "Peran", "Grup", "Status"]) {
      expect(html).toMatch(new RegExp(`<span[^>]*class="[^"]*\\bmd:hidden\\b[^"]*"[^>]*>${label}</span>`));
    }
  });

  it("makes the manage button, the create button and the filters 44px below xl", async () => {
    const html = await render("pengguna-layout-controls");

    expect(classOf(html, /<button[^>]*aria-label="Kelola Other User"[^>]*>/)).toMatch(/\bh-11\b.*\bxl:h-8\b/);
    expect(classOf(html, /<button[^>]*>(?=(?:(?!<\/button>).)*Tambah pengguna)/)).toMatch(/\bh-11\b/);
    expect(classOf(html, /<input[^>]*type="search"[^>]*>/)).toMatch(/\bh-11\b.*\btext-base\b/);
  });

  it("offers a phone sort select in the filter bar", async () => {
    const html = await render("pengguna-layout-sort");

    expect(html).toMatch(/<select[^>]*aria-label="Urutkan"[^>]*>/);
  });
});
