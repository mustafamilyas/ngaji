import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import AuditPage from "./page";

async function render(name: string) {
  const fixture = await buildPageFixture(name);
  mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
  await db.auditLog.create({
    data: {
      actorId: fixture.actorId,
      action: "member.create",
      entity: "Member",
      entityId: fixture.memberId,
      groupId: fixture.leaf.id,
      after: { name: "Anggota Uji" },
    },
  });
  return renderToStaticMarkup(await AuditPage({ searchParams: Promise.resolve({}) }));
}

/** Class attribute of the first tag matching `tagPattern`. */
function classOf(html: string, tagPattern: RegExp): string {
  const tag = html.match(tagPattern)?.[0] ?? "";
  return tag.match(/class="([^"]*)"/)?.[1] ?? "";
}

describe("AuditPage phone and tablet layout", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("lays each entry out as a stacked card below md and as a table row from md, in the same markup", async () => {
    const html = await render("audit-layout-stacked");

    expect(html).toMatch(/<table[^>]*class="[^"]*\bblock\b[^"]*\bmd:table\b/);
    expect(html).toMatch(/<thead[^>]*class="[^"]*\bhidden\b[^"]*\bmd:table-header-group\b/);
    expect(html).toMatch(/<tbody[^>]*class="[^"]*\bblock\b[^"]*\bmd:table-row-group\b/);
    expect(classOf(html, /<tr\b[^>]*class="[^"]*\bgrid\b[^"]*"[^>]*>/)).toContain("md:table-row");
  });

  it("labels the Aksi, Aktor and Entitas columns on the phone card only", async () => {
    const html = await render("audit-layout-labels");

    for (const label of ["Aksi", "Aktor", "Entitas"]) {
      expect(html).toMatch(new RegExp(`<span[^>]*class="[^"]*\\bmd:hidden\\b[^"]*"[^>]*>${label}</span>`));
    }
  });

  it("makes the Detail button 44px below xl", async () => {
    const html = await render("audit-layout-detail");

    expect(classOf(html, /<button[^>]*aria-label="Detail member.create"[^>]*>/)).toMatch(/\bsize-11\b.*\bxl:size-8\b/);
  });

  it("offers a phone sort select in the filter bar", async () => {
    const html = await render("audit-layout-sort");

    expect(html).toMatch(/<select[^>]*aria-label="Urutkan"[^>]*>/);
  });

  it("puts every filter, the date range included, in the filter panel", async () => {
    const html = await render("audit-layout-panel");
    // Below lg only primary controls sit before the panel; everything after its marker is behind "Filter".
    const [inline, panel] = html.split("data-filter-panel");

    expect(inline).not.toMatch(/<(select|input)[^>]*name=/);
    expect(panel).toContain("Semua grup");
    expect(panel).toMatch(/<input[^>]*type="hidden"[^>]*name="range"/);
    expect(panel).toMatch(/<select[^>]*aria-label="Aksi"/);
    expect(panel).toMatch(/<select[^>]*aria-label="Aktor"/);
    expect(panel).toMatch(/<select[^>]*aria-label="Urutkan"/);
  });
});
