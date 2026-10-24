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
import MemberDetailPage from "./page";

/** The opening tag of the first `<a>` whose content contains `text`. */
function anchorWith(html: string, text: string): string {
  return html.match(new RegExp(`<a [^>]*>(?:(?!</a>).)*${text}`))?.[0].match(/^<a [^>]*>/)?.[0] ?? "";
}

describe("MemberDetailPage phone and tablet layout", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("header group links, Ubah data and WhatsApp are 44px below xl", async () => {
    const fixture = await buildPageFixture("anggota-detail-layout");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
    const html = renderToStaticMarkup(
      await MemberDetailPage({ params: Promise.resolve({ id: String(fixture.memberId) }), searchParams: Promise.resolve({}) }),
    );

    expect(anchorWith(html, "Leaf")).toContain("min-h-11");
    expect(anchorWith(html, "Ubah data")).toContain("h-11");
    expect(anchorWith(html, "WhatsApp")).toContain("h-11");
  });
});
