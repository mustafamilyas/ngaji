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
import ActivityDetailPage from "./page";

function openingTag(html: string, tag: string, text: string): string {
  return html.match(new RegExp(`<${tag} [^>]*>(?:(?!</${tag}>).)*${text}`))?.[0].match(new RegExp(`^<${tag} [^>]*>`))?.[0] ?? "";
}

async function render(label: string, query: Record<string, string>) {
  const fixture = await buildPageFixture(label);
  mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.leaf) });
  return renderToStaticMarkup(
    await ActivityDetailPage({
      params: Promise.resolve({ id: String(fixture.activityId) }),
      searchParams: Promise.resolve(query),
    }),
  );
}

describe("ActivityDetailPage phone and tablet layout", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("header actions (Ubah) are 44px below xl", async () => {
    const html = await render("kegiatan-layout-header", {});
    expect(openingTag(html, "a", "Ubah")).toContain("h-11");
  });

  it("the group link in the header meta row is 44px below xl", async () => {
    const html = await render("kegiatan-layout-group-link", {});
    const tag = html.match(/<a [^>]*href="\/dashboard\/grup\/\d+"[^>]*>/)?.[0] ?? "";
    expect(tag).toContain("min-h-11");
    expect(tag).toContain("xl:min-h-0");
  });

  it("pengaturan tab: split link, end-activity form and delete are 44px with 16px text below xl", async () => {
    const html = await render("kegiatan-layout-pengaturan", { tab: "pengaturan" });
    expect(openingTag(html, "a", "Ubah ini")).toContain("h-11");
    const date = html.match(/<input[^>]*name="fromDate"[^>]*>/)?.[0] ?? "";
    expect(date).toContain("h-11");
    expect(date).toContain("text-base");
    expect(openingTag(html, "button", "Akhiri")).toContain("h-11");
    expect(openingTag(html, "button", "Hapus kegiatan")).toContain("h-11");
  });

  it("jadwal tab: Lihat and the edit pencil are 44px below xl", async () => {
    const html = await render("kegiatan-layout-jadwal", { tab: "jadwal" });
    expect(openingTag(html, "a", "Lihat")).toContain("h-11");
    expect(html.match(/<button [^>]*aria-label="Ubah jadwal[^>]*>/)?.[0] ?? "").toContain("size-11");
  });
});
