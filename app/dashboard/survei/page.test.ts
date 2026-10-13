import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import SurveyListPage from "./page";

describe("SurveyListPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  async function setup(label: string) {
    const fx = await buildPageFixture(label);
    await db.survey.create({ data: { groupId: fx.branch.id, title: "Kesiapan Ramadhan", createdById: fx.actorId } });
    await db.survey.create({ data: { groupId: fx.leaf.id, title: "Survei Kelompok Sendiri", createdById: fx.actorId } });
    return fx;
  }

  const render = async (searchParams: Record<string, string> = {}) =>
    renderToStaticMarkup(await SurveyListPage({ searchParams: Promise.resolve(searchParams) }));

  it("lists visible surveys with an inherited badge and per-row actions", async () => {
    const fx = await setup("survei-list");
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "USER", fx.leaf) });

    const html = await render();
    expect(html).toContain("Kesiapan Ramadhan");
    expect(html).toContain("Survei Kelompok Sendiri");
    expect(html).toContain("Diwarisi");
    expect(html).toContain("Aksi untuk Kesiapan Ramadhan");
  });

  it("hides the create button from USER and shows it to ADMIN", async () => {
    const fx = await setup("survei-list-create");

    mockAuthSession(auth, { user: sessionFor(fx.actorId, "USER", fx.leaf) });
    expect(await render()).not.toContain("Buat survei");

    mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.leaf) });
    expect(await render()).toContain("Buat survei");
  });

  it("applies search, sort and group filter from the URL", async () => {
    const fx = await setup("survei-list-filters");
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.branch) });

    const searched = await render({ q: "ramadhan" });
    expect(searched).toContain("Kesiapan Ramadhan");
    expect(searched).not.toContain("Survei Kelompok Sendiri");

    const sorted = await render({ sort: "judul", dir: "asc", grup: String(fx.leaf.id) });
    expect(sorted).toContain("Survei Kelompok Sendiri");
  });

  it("responds 404 for a group filter outside the caller's scope", async () => {
    const fx = await setup("survei-list-scope");
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "USER", fx.leaf) });

    await expect(render({ grup: String(fx.otherLeaf.id) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404"),
    });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(render()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });
});
