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
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import ActivityDetailPage from "./page";

describe("ActivityDetailPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the editable view for the owning group without crashing", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-owner");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({
        params: Promise.resolve({ id: String(fixture.activityId) }),
        searchParams: Promise.resolve({ tab: "pengaturan" }),
      }),
    );
    expect(html).toContain("Kajian Uji");
    expect(html).toContain("Ubah kegiatan");
    expect(html).toContain("Hapus kegiatan");
  });

  it("renders the read-only (inherited) view for an ancestor group without crashing", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-inherited");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({
        params: Promise.resolve({ id: String(fixture.activityId) }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("Kajian Uji");
    expect(html).toContain("diwarisi dari");
  });

  it("shows the activity's visible tags with a picker, also for a group that only inherits the activity (task 5.3)", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-tags");
    const tag = await db.tag.create({
      data: { groupId: fixture.root.id, key: "fokus-root", value: null, color: "blue", createdById: fixture.actorId },
    });
    await db.activityTag.create({ data: { activityId: fixture.activityId, tagId: tag.id, createdById: fixture.actorId } });
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({ params: Promise.resolve({ id: String(fixture.activityId) }), searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("fokus-root");
    expect(html).toContain("Atur tag");
  });

  it("shows activity tags read-only when the user can neither use nor create any (task 5.3)", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-tags-readonly");
    const tag = await db.tag.create({
      data: { groupId: fixture.leaf.id, key: "binaan-leaf", value: null, color: "blue", createdById: fixture.actorId },
    });
    await db.activityTag.create({ data: { activityId: fixture.activityId, tagId: tag.id, createdById: fixture.actorId } });
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.branch) });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({ params: Promise.resolve({ id: String(fixture.activityId) }), searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("binaan-leaf");
    expect(html).not.toContain("Atur tag");
  });

  it("never renders the settings tab for a caller who cannot edit, even when asked for it", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-inherited-settings");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({
        params: Promise.resolve({ id: String(fixture.activityId) }),
        searchParams: Promise.resolve({ tab: "pengaturan" }),
      }),
    );
    expect(html).not.toContain("Hapus kegiatan");
    expect(html).toContain("Rekap absensi");
  });

  it("shows the conflict warning banner when ?conflict=1", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-conflict");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({
        params: Promise.resolve({ id: String(fixture.activityId) }),
        searchParams: Promise.resolve({ conflict: "1" }),
      }),
    );
    expect(html).toContain("berkonflik dengan kegiatan lain");
  });

  it("404s for a non-numeric id", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-bad-id");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    await expect(
      ActivityDetailPage({ params: Promise.resolve({ id: "abc" }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
  });

  it("404s for an activity outside the caller's scope", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-out-of-scope");
    const outsider = sessionFor(fixture.actorId, "OWNER", fixture.otherLeaf);
    mockAuthSession(auth, { user: outsider });

    await expect(
      ActivityDetailPage({
        params: Promise.resolve({ id: String(fixture.activityId) }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(
      ActivityDetailPage({ params: Promise.resolve({ id: "1" }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });

  describe("Rincian kehadiran (task 6.2)", () => {
    async function render(label: string, searchParams: Record<string, string>) {
      const fixture = await buildPageFixture(label);
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.leaf) });
      return renderToStaticMarkup(
        await ActivityDetailPage({
          params: Promise.resolve({ id: String(fixture.activityId) }),
          searchParams: Promise.resolve(searchParams),
        }),
      );
    }

    it("offers the picker on the Absensi tab and shows the table once a dimension is chosen", async () => {
      const plain = await render("kegiatan-rincian-none", {});
      expect(plain).toContain("Rincian menurut");
      expect(plain).not.toContain("Berdasarkan data anggota saat ini.");
      const chosen = await render("kegiatan-rincian-sex", { rincian: "sex" });
      expect(chosen).toContain("Berdasarkan data anggota saat ini.");
    });

    it("ignores an unknown tag without an error", async () => {
      const html = await render("kegiatan-rincian-bad", { rincian: "tag:999999" });
      expect(html).not.toContain("Berdasarkan data anggota saat ini.");
    });
  });
});
