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

  it("renders a leaf group on its members tab by default, other lists on their own tab", async () => {
    const fixture = await buildPageFixture("grup-detail-leaf");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });
    const params = Promise.resolve({ id: String(fixture.leaf.id) });

    const html = renderToStaticMarkup(await GroupDetailPage({ params, searchParams: Promise.resolve({}) }));
    expect(html).toContain("Leaf");
    expect(html).toContain("Anggota Uji");
    expect(html).not.toContain("Kajian Uji");

    const activitiesHtml = renderToStaticMarkup(
      await GroupDetailPage({ params, searchParams: Promise.resolve({ tab: "kegiatan" }) }),
    );
    expect(activitiesHtml).toContain("Kajian Uji");
    expect(activitiesHtml).not.toContain("Anggota Uji");
  });

  it("falls back to the default tab for the settings tab when the caller cannot edit", async () => {
    const fixture = await buildPageFixture("grup-detail-user-settings");
    const session = sessionFor(fixture.actorId, "USER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await GroupDetailPage({
        params: Promise.resolve({ id: String(fixture.leaf.id) }),
        searchParams: Promise.resolve({ tab: "pengaturan" }),
      }),
    );
    expect(html).not.toContain("Hapus grup");
    expect(html).toContain("Anggota Uji");
  });

  it("renders a non-leaf group (with a sub-group add form) without crashing", async () => {
    const fixture = await buildPageFixture("grup-detail-branch");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await GroupDetailPage({ params: Promise.resolve({ id: String(fixture.branch.id) }), searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("Branch");
  });

  it("404s for a non-numeric id", async () => {
    const fixture = await buildPageFixture("grup-detail-bad-id");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    await expect(GroupDetailPage({ params: Promise.resolve({ id: "abc" }), searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
    });
  });

  it("404s for a group outside the caller's scope", async () => {
    const fixture = await buildPageFixture("grup-detail-out-of-scope");
    const outsider = sessionFor(fixture.actorId, "OWNER", fixture.otherLeaf);
    mockAuthSession(auth, { user: outsider });

    await expect(
      GroupDetailPage({ params: Promise.resolve({ id: String(fixture.leaf.id) }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(GroupDetailPage({ params: Promise.resolve({ id: "1" }), searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
