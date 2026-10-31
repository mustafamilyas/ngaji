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

  describe("Tag tab (task 5.7)", () => {
    async function setup(label: string) {
      const fixture = await buildPageFixture(label);
      const make = (key: string, value: string | null, color: string) =>
        db.tag.create({ data: { groupId: fixture.leaf.id, key, value, color, createdById: fixture.actorId } });
      await make("prioritas", "tinggi", "red");
      await make("prioritas", "rendah", "green");
      const simple = await make("fokus-tab", null, "blue");
      await db.memberTag.create({ data: { memberId: fixture.memberId, tagId: simple.id, createdById: fixture.actorId } });
      return fixture;
    }
    const render = async (fixture: Awaited<ReturnType<typeof setup>>, role: "OWNER" | "ADMIN" | "USER", group: "leaf" | "branch", tab?: string) => {
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, role, fixture[group]) });
      return renderToStaticMarkup(
        await GroupDetailPage({
          params: Promise.resolve({ id: String(fixture.leaf.id) }),
          searchParams: Promise.resolve(tab ? { tab } : {}),
        }),
      );
    };

    it("is offered to every user who can see the group, with the number of tags", async () => {
      const fixture = await setup("grup-detail-tag-tab");
      const html = await render(fixture, "USER", "leaf");
      expect(html).toContain("?tab=tag");
      expect(html).toMatch(/\?tab=tag"[^>]*>(?:<svg.*?<\/svg>)?Tag<span[^>]*>3<\/span>/);
    });

    it("lists the group's tags by key to a USER, without any management control", async () => {
      const fixture = await setup("grup-detail-tag-user");
      const html = await render(fixture, "USER", "leaf", "tag");
      expect(html).toContain("prioritas");
      expect(html).toContain("tinggi");
      expect(html).toContain("fokus-tab");
      expect(html).not.toContain("Tag baru");
      expect(html).not.toContain("Aksi untuk");
      expect(html).not.toContain("1 anggota");
    });

    it("gives an ADMIN of the owner group the controls and the usage counts", async () => {
      const fixture = await setup("grup-detail-tag-admin");
      const html = await render(fixture, "ADMIN", "leaf", "tag");
      expect(html).toContain("Tag baru");
      expect(html).toContain("Aksi untuk fokus-tab");
      expect(html).toContain("Aksi untuk kunci prioritas");
      expect(html).toContain("1 anggota");
    });

    it("shows an ancestor's ADMIN the descendant's tags without management controls", async () => {
      const fixture = await setup("grup-detail-tag-ancestor");
      const html = await render(fixture, "ADMIN", "branch", "tag");
      expect(html).toContain("fokus-tab");
      expect(html).not.toContain("Tag baru");
      expect(html).not.toContain("Aksi untuk");
    });

    it("says so when the group owns no tags", async () => {
      const fixture = await buildPageFixture("grup-detail-tag-empty");
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });
      const html = renderToStaticMarkup(
        await GroupDetailPage({
          params: Promise.resolve({ id: String(fixture.leaf.id) }),
          searchParams: Promise.resolve({ tab: "tag" }),
        }),
      );
      expect(html).toContain("Grup ini belum punya tag");
    });
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
