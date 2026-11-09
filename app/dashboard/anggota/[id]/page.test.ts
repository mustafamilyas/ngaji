import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  };
});

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildOrgFixture, buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import MemberDetailPage from "./page";

describe("MemberDetailPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders member details without crashing", async () => {
    const fixture = await buildPageFixture("anggota-detail");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await MemberDetailPage({ params: Promise.resolve({ id: String(fixture.memberId) }), searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("Anggota Uji");
    expect(html).not.toContain("Hapus anggota");
  });

  it("shows the member code in the header as one selectable unit, on every tab", async () => {
    const fixture = await buildPageFixture("anggota-detail-kode");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
    const { code } = await db.member.findUniqueOrThrow({ where: { id: fixture.memberId }, select: { code: true } });
    if (!code) throw new Error("fixture member has no code");

    for (const tab of ["profil", "kehadiran", "ubah"]) {
      const html = renderToStaticMarkup(
        await MemberDetailPage({ params: Promise.resolve({ id: String(fixture.memberId) }), searchParams: Promise.resolve({ tab }) }),
      );
      expect(html).toMatch(new RegExp(`<span[^>]*title="Kode anggota"[^>]*class="[^"]*select-all[^"]*"[^>]*>${code}</span>`));
    }
  });

  it("shows the Keluarga section on Profil only", async () => {
    const fixture = await buildPageFixture("anggota-detail-keluarga");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
    const htmlFor = async (tab?: string) =>
      renderToStaticMarkup(
        await MemberDetailPage({ params: Promise.resolve({ id: String(fixture.memberId) }), searchParams: Promise.resolve(tab ? { tab } : {}) }),
      );

    const profil = await htmlFor();
    expect(profil).toContain("Keluarga");
    expect(profil).toContain("Belum ada data keluarga");
    expect(await htmlFor("kehadiran")).not.toContain("Belum ada data keluarga");
  });

  describe("tags (task 5.3)", () => {
    const tagData = (groupId: number, key: string, actorId: number, extra: { deletedAt?: Date } = {}) => ({
      groupId,
      key,
      value: null,
      color: "blue",
      createdById: actorId,
      ...extra,
    });

    async function render(session: ReturnType<typeof sessionFor>, memberId: number) {
      mockAuthSession(auth, { user: session });
      return renderToStaticMarkup(
        await MemberDetailPage({ params: Promise.resolve({ id: String(memberId) }), searchParams: Promise.resolve({}) }),
      );
    }

    it("shows the member's visible tags with a picker to a user who can use tags", async () => {
      const fixture = await buildPageFixture("anggota-detail-tag-picker");
      const tag = await db.tag.create({ data: tagData(fixture.root.id, "fokus-root", fixture.actorId) });
      await db.memberTag.create({ data: { memberId: fixture.memberId, tagId: tag.id, createdById: fixture.actorId } });

      const html = await render(sessionFor(fixture.actorId, "USER", fixture.leaf), fixture.memberId);
      expect(html).toContain("fokus-root");
      expect(html).toContain("Atur tag");
    });

    it("shows tags read-only when the user can neither use nor create any", async () => {
      const fixture = await buildPageFixture("anggota-detail-tag-readonly");
      const tag = await db.tag.create({ data: tagData(fixture.leaf.id, "binaan-leaf", fixture.actorId) });
      await db.memberTag.create({ data: { memberId: fixture.memberId, tagId: tag.id, createdById: fixture.actorId } });

      // A USER at the branch sees the leaf's tag (descendant) but may use only the branch's and ancestors' tags.
      const html = await render(sessionFor(fixture.actorId, "USER", fixture.branch), fixture.memberId);
      expect(html).toContain("binaan-leaf");
      expect(html).not.toContain("Atur tag");
      expect(html).not.toContain("Hapus tag");
    });

    it("offers the picker to an ADMIN with no usable tags so they can create one", async () => {
      const fixture = await buildPageFixture("anggota-detail-tag-admin");
      const html = await render(sessionFor(fixture.actorId, "ADMIN", fixture.leaf), fixture.memberId);
      expect(html).toContain("Atur tag");
    });

    it("hides deleted tags and tags from another branch", async () => {
      const fixture = await buildPageFixture("anggota-detail-tag-hidden");
      const deleted = await db.tag.create({ data: tagData(fixture.root.id, "sudah-dihapus", fixture.actorId, { deletedAt: new Date() }) });
      const foreign = await db.tag.create({ data: tagData(fixture.otherLeaf.id, "cabang-lain", fixture.actorId) });
      await db.memberTag.create({ data: { memberId: fixture.memberId, tagId: deleted.id, createdById: fixture.actorId } });
      await db.memberTag.create({ data: { memberId: fixture.memberId, tagId: foreign.id, createdById: fixture.actorId } });

      const html = await render(sessionFor(fixture.actorId, "USER", fixture.leaf), fixture.memberId);
      expect(html).not.toContain("sudah-dihapus");
      expect(html).not.toContain("cabang-lain");
    });
  });

  it("shows the edit form and delete action on the edit tab", async () => {
    const fixture = await buildPageFixture("anggota-detail-ubah");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await MemberDetailPage({
        params: Promise.resolve({ id: String(fixture.memberId) }),
        searchParams: Promise.resolve({ tab: "ubah" }),
      }),
    );
    expect(html).toContain("Data anggota");
    expect(html).toContain("Hapus anggota");
  });

  it("404s for a non-numeric id", async () => {
    const fixture = await buildPageFixture("anggota-detail-bad-id");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    await expect(MemberDetailPage({ params: Promise.resolve({ id: "abc" }), searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
    });
  });

  it("404s for a member outside the caller's scope", async () => {
    const fixture = await buildPageFixture("anggota-detail-out-of-scope");
    const outsider = sessionFor(fixture.actorId, "OWNER", fixture.otherLeaf);
    mockAuthSession(auth, { user: outsider });

    await expect(
      MemberDetailPage({ params: Promise.resolve({ id: String(fixture.memberId) }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(MemberDetailPage({ params: Promise.resolve({ id: "1" }), searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("responds 404 for a member of another organization and renders none of their data", async () => {
    const orgA = await buildOrgFixture("anggota-detail-org-a");
    const orgB = await buildOrgFixture("anggota-detail-org-b");
    mockAuthSession(auth, { user: orgA.owner });

    await expect(
      MemberDetailPage({ params: Promise.resolve({ id: String(orgB.memberId) }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404") });
  });
});
