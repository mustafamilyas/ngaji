import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import StatisticsPage from "./page";

describe("StatisticsPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the anggota tab (default) without crashing", async () => {
    const fixture = await buildPageFixture("statistik-anggota");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(await StatisticsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Statistik");
  });

  it("renders the kegiatan tab without crashing", async () => {
    const fixture = await buildPageFixture("statistik-kegiatan");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await StatisticsPage({ searchParams: Promise.resolve({ tab: "kegiatan" }) }),
    );
    expect(html).toContain("Statistik");
  });

  it("renders the partisipasi tab without crashing", async () => {
    const fixture = await buildPageFixture("statistik-partisipasi");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await StatisticsPage({ searchParams: Promise.resolve({ tab: "partisipasi" }) }),
    );
    expect(html).toContain("Anggota Uji");
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(StatisticsPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
