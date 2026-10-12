import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { NAV_ITEMS } from "@/lib/nav";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import { emptyDefinition } from "@/lib/validation/member-view";
import MemberViewsPage from "./page";

function makeView(groupId: number, ownerId: number, name: string, extra: Record<string, unknown> = {}) {
  return db.memberView.create({
    data: { groupId, ownerId, createdById: ownerId, name, definition: emptyDefinition() as unknown as Prisma.InputJsonValue, ...extra },
  });
}

describe("MemberViewsPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders only the viewer's own-group views", async () => {
    const fixture = await buildPageFixture("tampilan-list");
    const owner = await db.user.create({ data: { username: "tampilan-list-owner", passwordHash: "x", name: "Pemilik Satu" } });
    await db.userGroupRole.create({ data: { userId: owner.id, groupId: fixture.leaf.id, role: "USER" } });
    await makeView(fixture.leaf.id, owner.id, "Remaja Aktif");
    await makeView(fixture.leaf.id, owner.id, "Sudah Dihapus", { deletedAt: new Date() });
    await makeView(fixture.branch.id, owner.id, "Milik Ancestor");
    await makeView(fixture.otherLeaf.id, owner.id, "Milik Saudara");

    mockAuthSession(auth, { user: sessionFor(owner.id, "USER", fixture.leaf) });
    const html = renderToStaticMarkup(await MemberViewsPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("Remaja Aktif");
    expect(html).toContain("Pemilik Satu");
    expect(html).toContain('href="/tampilan/baru"');
    expect(html).not.toContain("Sudah Dihapus");
    expect(html).not.toContain("Milik Ancestor");
    expect(html).not.toContain("Milik Saudara");
  });

  it("marks views whose owner moved away", async () => {
    const fixture = await buildPageFixture("tampilan-orphan");
    const moved = await db.user.create({ data: { username: "tampilan-orphan-moved", passwordHash: "x", name: "Pemilik Pindah" } });
    await db.userGroupRole.create({ data: { userId: moved.id, groupId: fixture.otherLeaf.id, role: "USER" } });
    await makeView(fixture.leaf.id, moved.id, "Tampilan Yatim");

    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });
    const html = renderToStaticMarkup(await MemberViewsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Tampilan Yatim");
    expect(html).toContain("Tanpa pemilik");
  });

  it("filters by the search term", async () => {
    const fixture = await buildPageFixture("tampilan-search");
    await makeView(fixture.leaf.id, fixture.actorId, "Remaja Aktif");
    await makeView(fixture.leaf.id, fixture.actorId, "Lansia");

    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });
    const html = renderToStaticMarkup(await MemberViewsPage({ searchParams: Promise.resolve({ q: "remaja" }) }));
    expect(html).toContain("Remaja Aktif");
    expect(html).not.toContain("Lansia");
  });

  it("renders the empty state", async () => {
    const fixture = await buildPageFixture("tampilan-empty");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });
    const html = renderToStaticMarkup(await MemberViewsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Belum ada tampilan.");
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(MemberViewsPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});

describe("sidebar nav", () => {
  it("has a Tampilan item right after Anggota", () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(NAV_ITEMS.find((i) => i.href === "/tampilan")?.label).toBe("Tampilan");
    expect(hrefs.indexOf("/tampilan")).toBe(hrefs.indexOf("/anggota") + 1);
  });
});
