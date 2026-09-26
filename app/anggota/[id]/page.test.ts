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

describe("MemberDetailPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders member details without crashing", async () => {
    const fixture = await buildPageFixture("anggota-detail");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await MemberDetailPage({ params: Promise.resolve({ id: String(fixture.memberId) }) }),
    );
    expect(html).toContain("Anggota Uji");
  });

  it("404s for a non-numeric id", async () => {
    const fixture = await buildPageFixture("anggota-detail-bad-id");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    await expect(MemberDetailPage({ params: Promise.resolve({ id: "abc" }) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
    });
  });

  it("404s for a member outside the caller's scope", async () => {
    const fixture = await buildPageFixture("anggota-detail-out-of-scope");
    const outsider = sessionFor(fixture.actorId, "OWNER", fixture.otherLeaf);
    mockAuthSession(auth, { user: outsider });

    await expect(
      MemberDetailPage({ params: Promise.resolve({ id: String(fixture.memberId) }) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(MemberDetailPage({ params: Promise.resolve({ id: "1" }) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
