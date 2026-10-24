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
import GroupDetailPage from "./page";

function openingTag(html: string, tag: string, text: string): string {
  return html.match(new RegExp(`<${tag} [^>]*>(?:(?!</${tag}>).)*${text}`))?.[0].match(new RegExp(`^<${tag} [^>]*>`))?.[0] ?? "";
}

let leafId = 0;

async function render(label: string, pick: "leaf" | "branch", query: Record<string, string> = {}) {
  const fixture = await buildPageFixture(label);
  leafId = fixture.leaf.id;
  mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
  const id = pick === "leaf" ? fixture.leaf.id : fixture.branch.id;
  return renderToStaticMarkup(
    await GroupDetailPage({ params: Promise.resolve({ id: String(id) }), searchParams: Promise.resolve(query) }),
  );
}

describe("GroupDetailPage phone and tablet layout", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("header actions of a leaf group are 44px below xl", async () => {
    const html = await render("grup-layout-leaf", "leaf");
    expect(openingTag(html, "a", "Lihat semua anggota")).toContain("h-11");
    expect(openingTag(html, "a", "Tambah anggota")).toContain("h-11");
  });

  it("the add-subgroup trigger of a branch group is 44px below xl", async () => {
    const html = await render("grup-layout-branch", "branch", { tab: "subgrup" });
    expect(openingTag(html, "button", "Tambah")).toContain("h-11");
  });

  it("child-group rows are at least 44px tall", async () => {
    const html = await render("grup-layout-rows", "branch", { tab: "subgrup" });
    const row = html.match(new RegExp(`<a [^>]*href="/dashboard/grup/${leafId}"[^>]*>`))?.[0] ?? "";
    expect(row).toContain("min-h-11");
  });

  it("settings tab: rename field, Ganti nama and Hapus grup are 44px with 16px text below xl", async () => {
    const html = await render("grup-layout-settings", "leaf", { tab: "pengaturan" });
    const input = html.match(/<input[^>]*name="name"[^>]*>/)?.[0] ?? "";
    expect(input).toContain("h-11");
    expect(input).toContain("text-base");
    // `flex-1` in the phone's column layout collapses the field's height to its content.
    expect(input).not.toMatch(/(^|[\s"])flex-1/);
    expect(openingTag(html, "button", "Ganti nama")).toContain("h-11");
    expect(openingTag(html, "button", "Hapus grup")).toContain("h-11");
  });
});
