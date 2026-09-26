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
import SplitActivityPage from "./page";

describe("SplitActivityPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the split form for the owning group without crashing", async () => {
    const fixture = await buildPageFixture("kegiatan-geser");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await SplitActivityPage({ params: Promise.resolve({ id: String(fixture.activityId) }) }),
    );
    expect(html).toContain("Ubah ini &amp; seterusnya");
  });

  it("404s when the caller can't edit the activity (not the owning group)", async () => {
    const fixture = await buildPageFixture("kegiatan-geser-forbidden");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    await expect(
      SplitActivityPage({ params: Promise.resolve({ id: String(fixture.activityId) }) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
  });

  it("404s for a non-numeric id", async () => {
    const fixture = await buildPageFixture("kegiatan-geser-bad-id");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    await expect(SplitActivityPage({ params: Promise.resolve({ id: "abc" }) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
    });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(SplitActivityPage({ params: Promise.resolve({ id: "1" }) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
