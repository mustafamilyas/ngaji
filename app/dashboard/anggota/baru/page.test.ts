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
import NewMemberPage from "./page";


/** Classes of the card that wraps the form: a clipping card would stop the form's sticky bar from sticking. */
function formCardClass(html: string): string {
  const before = html.slice(0, html.indexOf("<form"));
  const tagStart = before.lastIndexOf('<div data-slot="card"');
  return before.slice(tagStart).match(/class="([^"]*)"/)?.[1] ?? "";
}

describe("NewMemberPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the new-member form without crashing", async () => {
    const fixture = await buildPageFixture("anggota-baru");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(await NewMemberPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Anggota baru");
  });

  it("does not clip the card around the form, so the sticky Simpan bar can stick", async () => {
    const fixture = await buildPageFixture("anggota-baru-sticky");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });

    const html = renderToStaticMarkup(await NewMemberPage({ searchParams: Promise.resolve({}) }));
    const cls = formCardClass(html);
    expect(cls).toMatch(/\boverflow-visible\b/);
    expect(cls).not.toMatch(/\boverflow-hidden\b/);
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(NewMemberPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
