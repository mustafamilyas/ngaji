import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
// The page reads the column-preference cookie; there is no request scope in tests.
const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieValue.current ? { value: cookieValue.current } : undefined) }),
}));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import MembersPage from "./page";

describe("MembersPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the member list without crashing", async () => {
    const fixture = await buildPageFixture("anggota-list");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(await MembersPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Anggota Uji");
  });

  it("renders with search/status/page filters applied without crashing", async () => {
    const fixture = await buildPageFixture("anggota-list-filters");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await MembersPage({
        searchParams: Promise.resolve({ q: "Uji", status: "AKTIF", grup: String(fixture.leaf.id), page: "1" }),
      }),
    );
    expect(html).toContain("Anggota Uji");
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(MembersPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("renders only the optional columns chosen in the cookie", async () => {
    const fixture = await buildPageFixture("anggota-kolom");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    cookieValue.current = "alamat";
    try {
      const html = renderToStaticMarkup(await MembersPage({ searchParams: Promise.resolve({}) }));
      expect(html).toContain("Alamat");
      expect(html).not.toContain("Jenis kelamin");
      expect(html).not.toContain("wa.me");
    } finally {
      cookieValue.current = undefined;
    }
  });
});
