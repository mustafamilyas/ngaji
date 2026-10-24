import { afterAll, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import { emptyDefinition, type Definition } from "@/lib/validation/member-view";
import { RuleGroupEditor } from "../rule-editor";
import MemberViewPage from "./page";

async function render(name: string, definition: Partial<Definition> = {}) {
  const fixture = await buildPageFixture(name);
  const owner = await db.user.create({ data: { username: `${name}-owner`, passwordHash: "x", name: "Pemilik Uji" } });
  await db.userGroupRole.create({ data: { userId: owner.id, groupId: fixture.leaf.id, role: "USER" } });
  const full: Definition = {
    ...emptyDefinition(),
    columns: ["whatsapp", "status"],
    filter: { op: "AND", groups: [{ op: "AND", rules: [{ field: "status", operator: "isAnyOf", value: ["AKTIF"] }] }] },
    ...definition,
  };
  const view = await db.memberView.create({
    data: {
      groupId: fixture.leaf.id,
      ownerId: owner.id,
      createdById: owner.id,
      name: `Tampilan ${name}`,
      definition: full as unknown as Prisma.InputJsonValue,
    },
  });
  mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });
  return renderToStaticMarkup(
    await MemberViewPage({ params: Promise.resolve({ id: String(view.id) }), searchParams: Promise.resolve({}) }),
  );
}

/** Class attribute of the first tag matching `tagPattern`. */
function classOf(html: string, tagPattern: RegExp): string {
  const tag = html.match(tagPattern)?.[0] ?? "";
  return tag.match(/class="([^"]*)"/)?.[1] ?? "";
}

const buttonWith = (text: string) => new RegExp(`<button(?=[^>]*>(?:(?!</button>).)*${text})[^>]*>`);

describe("member view page phone and tablet layout", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("lays each result out as a stacked card below md and as a table row from md, in the same markup", async () => {
    const html = await render("tampilan-layout-stacked");

    expect(html).toMatch(/<table[^>]*class="[^"]*\bblock\b[^"]*\bmd:table\b/);
    expect(html).toMatch(/<thead[^>]*class="[^"]*\bhidden\b[^"]*\bmd:table-header-group\b/);
    expect(html).toMatch(/<tbody[^>]*class="[^"]*\bblock\b[^"]*\bmd:table-row-group\b/);
    expect(classOf(html, /<tr\b[^>]*class="[^"]*\bgrid\b[^"]*"[^>]*>/)).toContain("md:table-row");
    expect(html).toMatch(/<span[^>]*class="[^"]*\bmd:hidden\b[^"]*"[^>]*>Status<\/span>/);
  });

  it("makes the name link and the WhatsApp button 44px below xl", async () => {
    const html = await render("tampilan-layout-row");

    expect(classOf(html, /<a[^>]*href="\/dashboard\/anggota\/\d+"[^>]*>/)).toMatch(/\bmin-h-11\b/);
    expect(classOf(html, /<a[^>]*aria-label="Kirim pesan WhatsApp ke[^"]*"[^>]*>/)).toMatch(/\bsize-11\b/);
  });

  it("makes the header actions and the filter bar controls 44px below xl", async () => {
    const html = await render("tampilan-layout-bar");

    for (const text of ["Simpan sebagai baru", "Tambah filter", "Filter \\(1\\)", "Tampilan"]) {
      expect(classOf(html, buttonWith(text)), text).toMatch(/\bh-11\b/);
    }
    expect(classOf(html, /<button[^>]*aria-label="Hapus filter"[^>]*>/)).toMatch(/\bsize-11\b.*\bxl:size-/);
  });
});

describe("rule editor phone and tablet sizes", () => {
  const html = renderToStaticMarkup(
    createElement(RuleGroupEditor, {
      group: {
        op: "AND",
        rules: [
          { field: "status", operator: "isAnyOf", value: ["AKTIF"] },
          { field: "age", operator: "between", value: [13, 17] },
        ],
      },
      groups: [],
      onChange: () => undefined,
      onRemove: () => undefined,
    }),
  );

  it("makes the selects, number inputs and buttons 44px with 16px text below xl", () => {
    for (const tag of [
      /<select[^>]*aria-label="Kolom"[^>]*>/,
      /<select[^>]*aria-label="Operator"[^>]*>/,
      /<select[^>]*aria-label="Gabungkan aturan"[^>]*>/,
      /<input[^>]*aria-label="Usia minimum"[^>]*>/,
    ]) {
      const cls = classOf(html, tag);
      expect(cls, String(tag)).toMatch(/\bh-11\b/);
      expect(cls, String(tag)).toMatch(/\btext-base\b/);
    }
    expect(classOf(html, /<button[^>]*aria-label="Hapus aturan"[^>]*>/)).toMatch(/\bsize-11\b.*\bxl:size-/);
    expect(classOf(html, buttonWith("Tambah aturan"))).toMatch(/\bh-11\b/);
    expect(classOf(html, buttonWith("Hapus filter"))).toMatch(/\bh-11\b/);
  });

  it("makes the choice checkbox rows 44px tall", () => {
    expect(classOf(html, /<label[^>]*>(?=<input[^>]*type="checkbox")/)).toMatch(/\bmin-h-11\b/);
  });
});
