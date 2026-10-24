import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, type PageFixture, sessionFor } from "@/lib/test/fixtures";
import SettingsPage from "./page";

/** The fixture session must carry the org id (task 10.3: `sessionFor` defaults to 0). */
const rootOf = (fixture: PageFixture) => ({ ...fixture.root, organizationId: fixture.organizationId });

describe("SettingsPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the organization form and the level rename forms for a root owner", async () => {
    const fixture = await buildPageFixture("pengaturan-root-owner");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", rootOf(fixture)) });

    const html = renderToStaticMarkup(await SettingsPage());
    expect(html).toContain("pengaturan-root-owner Org");
    expect(html).toContain('name="timezone"');
    expect(html).toContain("WIB");
    expect(html).toContain("WITA");
    expect(html).toContain("WIT");
    expect(html).toContain("Root");
    expect(html).toContain("Branch");
    expect(html).toContain("Leaf");
    expect(html).not.toContain("tidak memiliki izin");
  });

  it("shows only the caller's own organization", async () => {
    const mine = await buildPageFixture("pengaturan-mine");
    await buildPageFixture("pengaturan-other");
    mockAuthSession(auth, { user: sessionFor(mine.actorId, "OWNER", rootOf(mine)) });

    const html = renderToStaticMarkup(await SettingsPage());
    expect(html).toContain("pengaturan-mine Org");
    expect(html).not.toContain("pengaturan-other Org");
  });

  it("preselects the organization's current timezone", async () => {
    const fixture = await buildPageFixture("pengaturan-tz");
    await db.organization.update({ where: { id: fixture.organizationId }, data: { timezone: "Asia/Jayapura" } });
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", rootOf(fixture)) });

    const html = renderToStaticMarkup(await SettingsPage());
    expect(html).toMatch(/<option[^>]*value="Asia\/Jayapura"[^>]*selected/);
  });

  it("renders a permission notice and no form for an ADMIN at the root", async () => {
    const fixture = await buildPageFixture("pengaturan-admin-root");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", rootOf(fixture)) });

    const html = renderToStaticMarkup(await SettingsPage());
    expect(html).toContain("tidak memiliki izin");
    expect(html).not.toContain("<form");
  });

  it("renders a permission notice and no form for an OWNER below the root", async () => {
    const fixture = await buildPageFixture("pengaturan-non-root");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", { ...fixture.leaf, organizationId: fixture.organizationId }) });

    const html = renderToStaticMarkup(await SettingsPage());
    expect(html).toContain("tidak memiliki izin");
    expect(html).not.toContain("<form");
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(SettingsPage()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
