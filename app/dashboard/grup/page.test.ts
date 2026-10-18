import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import GroupTreePage from "./page";

describe("GroupTreePage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the group tree without crashing for a root owner", async () => {
    const fixture = await buildPageFixture("grup-tree-root");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(await GroupTreePage());
    expect(html).toContain("Root");
    expect(html).toContain("Pengaturan jenjang");
  });

  it("renders without crashing for a non-root session (no jenjang link)", async () => {
    const fixture = await buildPageFixture("grup-tree-leaf");
    const session = sessionFor(fixture.actorId, "USER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(await GroupTreePage());
    expect(html).toContain("Leaf");
    expect(html).not.toContain("Pengaturan jenjang");
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(GroupTreePage()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
