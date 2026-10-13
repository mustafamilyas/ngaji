import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import LevelSettingsPage from "./page";

describe("LevelSettingsPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the level rename forms for a root owner without crashing", async () => {
    const fixture = await buildPageFixture("jenjang-root-owner");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(await LevelSettingsPage());
    expect(html).toContain("Root");
    expect(html).toContain("Branch");
    expect(html).toContain("Leaf");
  });

  it("renders a permission notice (not a crash) for a non-root-owner", async () => {
    const fixture = await buildPageFixture("jenjang-non-root");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(await LevelSettingsPage());
    expect(html).toContain("tidak memiliki izin");
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(LevelSettingsPage()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
