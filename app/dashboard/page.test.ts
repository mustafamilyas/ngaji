import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import DashboardPage from "./page";

describe("DashboardPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders without crashing for a logged-in user", async () => {
    const fixture = await buildPageFixture("dashboard-page");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toContain("Dasbor");
  });

  it("makes the links to details and lists 44px tap targets below xl", async () => {
    const fixture = await buildPageFixture("dashboard-page-links");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });

    const html = renderToStaticMarkup(await DashboardPage());
    const classOf = (pattern: RegExp) => (html.match(pattern)?.[0] ?? "").match(/class="([^"]*)"/)?.[1] ?? "";
    expect(classOf(/<a[^>]*href="\/dashboard\/kegiatan"[^>]*>(?=Lihat semua)/)).toMatch(/\bmin-h-11\b/);
    expect(classOf(/<a[^>]*href="\/dashboard\/anggota"[^>]*>(?=Lihat semua)/)).toMatch(/\bmin-h-11\b/);
  });
});
