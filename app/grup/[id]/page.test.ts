import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import GroupDetailPage from "./page";

describe("GroupDetailPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders a leaf group (with members and activities) without crashing", async () => {
    const fixture = await buildPageFixture("grup-detail-leaf");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await GroupDetailPage({ params: Promise.resolve({ id: String(fixture.leaf.id) }) }),
    );
    expect(html).toContain("Leaf");
    expect(html).toContain("Anggota Uji");
    expect(html).toContain("Kajian Uji");
  });

  it("renders a non-leaf group (with a sub-group add form) without crashing", async () => {
    const fixture = await buildPageFixture("grup-detail-branch");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await GroupDetailPage({ params: Promise.resolve({ id: String(fixture.branch.id) }) }),
    );
    expect(html).toContain("Branch");
  });

  it("404s for a non-numeric id", async () => {
    const fixture = await buildPageFixture("grup-detail-bad-id");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    await expect(GroupDetailPage({ params: Promise.resolve({ id: "abc" }) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
    });
  });

  it("404s for a group outside the caller's scope", async () => {
    const fixture = await buildPageFixture("grup-detail-out-of-scope");
    const outsider = sessionFor(fixture.actorId, "OWNER", fixture.otherLeaf);
    mockAuthSession(auth, { user: outsider });

    await expect(
      GroupDetailPage({ params: Promise.resolve({ id: String(fixture.leaf.id) }) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(GroupDetailPage({ params: Promise.resolve({ id: "1" }) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
