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
import { buildOrgFixture, buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import MemberDetailPage from "./page";

describe("MemberDetailPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders member details without crashing", async () => {
    const fixture = await buildPageFixture("anggota-detail");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await MemberDetailPage({ params: Promise.resolve({ id: String(fixture.memberId) }), searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("Anggota Uji");
    expect(html).not.toContain("Hapus anggota");
  });

  it("shows the edit form and delete action on the edit tab", async () => {
    const fixture = await buildPageFixture("anggota-detail-ubah");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await MemberDetailPage({
        params: Promise.resolve({ id: String(fixture.memberId) }),
        searchParams: Promise.resolve({ tab: "ubah" }),
      }),
    );
    expect(html).toContain("Data anggota");
    expect(html).toContain("Hapus anggota");
  });

  it("404s for a non-numeric id", async () => {
    const fixture = await buildPageFixture("anggota-detail-bad-id");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    await expect(MemberDetailPage({ params: Promise.resolve({ id: "abc" }), searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
    });
  });

  it("404s for a member outside the caller's scope", async () => {
    const fixture = await buildPageFixture("anggota-detail-out-of-scope");
    const outsider = sessionFor(fixture.actorId, "OWNER", fixture.otherLeaf);
    mockAuthSession(auth, { user: outsider });

    await expect(
      MemberDetailPage({ params: Promise.resolve({ id: String(fixture.memberId) }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(MemberDetailPage({ params: Promise.resolve({ id: "1" }), searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("responds 404 for a member of another organization and renders none of their data", async () => {
    const orgA = await buildOrgFixture("anggota-detail-org-a");
    const orgB = await buildOrgFixture("anggota-detail-org-b");
    mockAuthSession(auth, { user: orgA.owner });

    await expect(
      MemberDetailPage({ params: Promise.resolve({ id: String(orgB.memberId) }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404") });
  });
});
