import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/font/google", () => ({
  Bricolage_Grotesque: () => ({ variable: "", className: "" }),
}));

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

  it("renders the landing page without touching the database when there is no session", async () => {
    mockAuthSession(auth, null);
    const spy = vi.spyOn(db.organization, "findFirst");
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toContain("Dahan");
    expect(html).toContain('href="/login"');
    expect(html).not.toContain("Dasbor");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
