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

describe("ActivityDetailPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the editable view for the owning group without crashing", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-owner");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({
        params: Promise.resolve({ id: String(fixture.activityId) }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("Kajian Uji");
    expect(html).toContain("Ubah kegiatan");
  });

  it("renders the read-only (inherited) view for an ancestor group without crashing", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-inherited");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({
        params: Promise.resolve({ id: String(fixture.activityId) }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("Kajian Uji");
    expect(html).toContain("diwarisi dari");
  });

  it("shows the conflict warning banner when ?conflict=1", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-conflict");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({
        params: Promise.resolve({ id: String(fixture.activityId) }),
        searchParams: Promise.resolve({ conflict: "1" }),
      }),
    );
    expect(html).toContain("berkonflik dengan kegiatan lain");
  });

  it("404s for a non-numeric id", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-bad-id");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    await expect(
      ActivityDetailPage({ params: Promise.resolve({ id: "abc" }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
  });

  it("404s for an activity outside the caller's scope", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-out-of-scope");
    const outsider = sessionFor(fixture.actorId, "OWNER", fixture.otherLeaf);
    mockAuthSession(auth, { user: outsider });

    await expect(
      ActivityDetailPage({
        params: Promise.resolve({ id: String(fixture.activityId) }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(
      ActivityDetailPage({ params: Promise.resolve({ id: "1" }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });
});
