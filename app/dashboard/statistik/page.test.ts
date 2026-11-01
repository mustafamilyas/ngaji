import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
// The "Per tag" picker navigates with the app router, which does not exist in a static render.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import StatisticsPage from "./page";

describe("StatisticsPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the anggota tab (default) without crashing", async () => {
    const fixture = await buildPageFixture("statistik-anggota");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(await StatisticsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Statistik");
  });

  it("renders the kegiatan tab without crashing", async () => {
    const fixture = await buildPageFixture("statistik-kegiatan");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await StatisticsPage({ searchParams: Promise.resolve({ tab: "kegiatan" }) }),
    );
    expect(html).toContain("Statistik");
  });

  it("renders the partisipasi tab without crashing", async () => {
    const fixture = await buildPageFixture("statistik-partisipasi");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await StatisticsPage({ searchParams: Promise.resolve({ tab: "partisipasi" }) }),
    );
    expect(html).toContain("Anggota Uji");
  });

  describe("Rincian kehadiran (task 6.2)", () => {
    const render = async (fixtureLabel: string, searchParams: Record<string, string>) => {
      const fixture = await buildPageFixture(fixtureLabel);
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
      return { fixture, html: renderToStaticMarkup(await StatisticsPage({ searchParams: Promise.resolve({ tab: "kegiatan", ...searchParams }) })) };
    };

    it("offers the picker and no table by default", async () => {
      const { html } = await render("statistik-rincian-none", {});
      expect(html).toContain("Rincian menurut");
      expect(html).not.toContain("Berdasarkan data anggota saat ini.");
    });

    it("shows the breakdown table with the as-of-today hint for a fixed dimension", async () => {
      const { html } = await render("statistik-rincian-sex", { rincian: "sex" });
      expect(html).toContain("Berdasarkan data anggota saat ini.");
      expect(html).toContain("Tidak hadir");
    });

    it("ignores an invisible or unknown rincian without an error", async () => {
      const { html } = await render("statistik-rincian-bad", { rincian: "tag:999999" });
      expect(html).not.toContain("Berdasarkan data anggota saat ini.");
      const junk = await render("statistik-rincian-junk", { rincian: "phone" });
      expect(junk.html).not.toContain("Berdasarkan data anggota saat ini.");
    });
  });

  describe("Per tag (task 5.1)", () => {
    const tagOf = (groupId: number, actorId: number, key: string, value: string | null) =>
      db.tag.create({ data: { groupId, key, value, color: "slate", createdById: actorId } });

    it("shows the picker with a hint before a tag is chosen", async () => {
      const fixture = await buildPageFixture("statistik-pertag-empty");
      await tagOf(fixture.root.id, fixture.actorId, "prioritas", "tinggi");
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });

      const html = renderToStaticMarkup(await StatisticsPage({ searchParams: Promise.resolve({}) }));
      expect(html).toContain("Per tag");
      expect(html).toContain("Pilih tag untuk melihat rinciannya.");
    });

    it("breaks the scope down by the chosen key, with Tanpa nilai", async () => {
      const fixture = await buildPageFixture("statistik-pertag-key");
      const tinggi = await tagOf(fixture.root.id, fixture.actorId, "prioritas", "tinggi");
      await db.memberTag.create({ data: { memberId: fixture.memberId, tagId: tinggi.id, createdById: fixture.actorId } });
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });

      const html = renderToStaticMarkup(
        await StatisticsPage({ searchParams: Promise.resolve({ tag: String(tinggi.id) }) }),
      );
      expect(html).toContain("tinggi");
      expect(html).toContain("Tanpa nilai");
      expect(html).not.toContain("Pilih tag untuk melihat rinciannya.");
    });

    it("ignores a tag owned by a sibling branch, without an error", async () => {
      const fixture = await buildPageFixture("statistik-pertag-hidden");
      const hidden = await tagOf(fixture.otherLeaf.id, fixture.actorId, "rahasia", "x");
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.leaf) });

      const html = renderToStaticMarkup(
        await StatisticsPage({ searchParams: Promise.resolve({ tag: String(hidden.id) }) }),
      );
      expect(html).not.toContain("rahasia");
      expect(html).toContain("Belum ada tag.");
    });

    it("still answers 404 for a group outside the viewer's scope", async () => {
      const fixture = await buildPageFixture("statistik-pertag-scope");
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.leaf) });

      await expect(
        StatisticsPage({ searchParams: Promise.resolve({ grup: String(fixture.otherLeaf.id) }) }),
      ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404") });
    });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(StatisticsPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
