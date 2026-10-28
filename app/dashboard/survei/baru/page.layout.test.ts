import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  };
});

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import NewSurveyPage from "./page";

async function render(name: string) {
  const fixture = await buildPageFixture(name);
  mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.branch) });
  return renderToStaticMarkup(await NewSurveyPage());
}

/** Class attribute of the first tag matching `tagPattern`. */
function classOf(html: string, tagPattern: RegExp): string {
  const tag = html.match(tagPattern)?.[0] ?? "";
  return tag.match(/class="([^"]*)"/)?.[1] ?? "";
}

describe("survey form phone and tablet sizes", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("makes the text fields 44px tall with 16px text below xl, also from md", async () => {
    const html = await render("survei-form-fields");

    for (const tag of [
      /<input[^>]*id="title"[^>]*>/,
      /<input[^>]*id="q-0-label"[^>]*>/,
      /<input[^>]*id="q-0-help"[^>]*>/,
    ]) {
      const cls = classOf(html, tag);
      expect(cls, String(tag)).toMatch(/\bh-11\b|\bmin-h-11\b/);
      expect(cls, String(tag)).toMatch(/\btext-base\b/);
      expect(cls, String(tag)).toMatch(/\bxl:text-sm\b/);
      expect(cls, String(tag)).not.toMatch(/\bmd:text-sm\b/);
    }
  });

  it("keeps the description textarea at 16px text from md", async () => {
    const html = await render("survei-form-description");

    const cls = classOf(html, /<textarea[^>]*id="description"[^>]*>/);
    expect(cls).toMatch(/\btext-base\b/);
    expect(cls).toMatch(/\bxl:text-sm\b/);
    expect(cls).not.toMatch(/\bmd:text-sm\b/);
  });

  it("makes the move, delete and question-type controls 44px below xl", async () => {
    const html = await render("survei-form-card-controls");

    for (const label of ["Naikkan pertanyaan 1", "Turunkan pertanyaan 1", "Hapus pertanyaan 1"]) {
      expect(classOf(html, new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`)), label).toMatch(/\bsize-11\b.*\bxl:size-8\b/);
    }
    expect(classOf(html, /<button[^>]*id="q-0-type"[^>]*>/)).toMatch(/data-\[size=default\]:h-11.*xl:data-\[size=default\]:h-8/);
  });

  it("makes the add, save and required controls 44px below xl", async () => {
    const html = await render("survei-form-actions");

    for (const text of ["Tambah pertanyaan", "Tambah Ya/Tidak", "Simpan survei"]) {
      const cls = classOf(html, new RegExp(`<button(?=[^>]*>(?:(?!</button>).)*${text.replace("/", "\\/")})[^>]*>`));
      expect(cls, text).toMatch(/\bh-11\b.*\bxl:h-8\b|\bh-11\b.*\bxl:h-9\b/);
    }
    expect(classOf(html, /<label(?=[^>]*>(?:(?!<\/label>).)*Wajib diisi)[^>]*>/)).toMatch(/\bmin-h-11\b/);
  });
});
