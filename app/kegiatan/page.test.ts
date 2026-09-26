import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import ActivityListPage from "./page";

describe("ActivityListPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the default (this week) range without crashing", async () => {
    const fixture = await buildPageFixture("kegiatan-list");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(await ActivityListPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Kajian Uji");
  });

  it("renders an explicit date range and group filter without crashing", async () => {
    const fixture = await buildPageFixture("kegiatan-list-filters");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityListPage({
        searchParams: Promise.resolve({ from: "2024-01-01", to: "2024-01-31", grup: String(fixture.leaf.id) }),
      }),
    );
    expect(html).toContain("Kegiatan");
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(ActivityListPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
