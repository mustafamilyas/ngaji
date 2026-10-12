import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
import { type PageFixture, buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import SurveyDetailPage from "./page";

describe("SurveyDetailPage", () => {
  let fx: PageFixture;
  let surveyId: number;
  let otherMemberId: number;

  beforeAll(async () => {
    fx = await buildPageFixture("survei-detail");
    const survey = await db.survey.create({
      data: {
        groupId: fx.branch.id,
        createdById: fx.actorId,
        title: "Kesiapan Ramadhan",
        description: "Survei awal",
        questions: {
          create: [
            {
              order: 0,
              type: "SINGLE_CHOICE",
              label: "Siap berpuasa?",
              options: { create: [{ order: 0, label: "Ya" }, { order: 1, label: "Tidak" }] },
            },
            { order: 1, type: "SHORT_TEXT", label: "Pertanyaan lama", archivedAt: new Date() },
          ],
        },
      },
      include: { questions: { include: { options: true } } },
    });
    surveyId = survey.id;

    const response = await db.surveyResponse.create({
      data: { surveyId, memberId: fx.memberId, recordedById: fx.actorId },
    });
    await db.surveyAnswer.create({
      data: {
        responseId: response.id,
        questionId: survey.questions[0].id,
        optionId: survey.questions[0].options[0].id,
      },
    });

    otherMemberId = (
      await db.member.create({
        data: {
          groupId: fx.otherLeaf.id,
          name: "Warga Cabang",
          birthPlace: "Bandung",
          birthDate: "1999-05-05",
          sex: "P",
          address: "Jl. Uji No. 9",
          phone: "081200000009",
          maritalStatus: "BELUM_MENIKAH",
          workStatus: "BEKERJA",
          status: "AKTIF",
          joinedAt: "2024-01-01",
          createdById: fx.actorId,
        },
      })
    ).id;
    await db.surveyResponse.create({ data: { surveyId, memberId: otherMemberId, recordedById: fx.actorId } });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  function render(tab?: string) {
    return SurveyDetailPage({
      params: Promise.resolve({ id: String(surveyId) }),
      searchParams: Promise.resolve(tab ? { tab } : {}),
    });
  }

  it("opens on the Hasil tab with all three tabs listed", async () => {
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.branch) });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Kesiapan Ramadhan");
    expect(html).toContain("Survei awal");
    for (const label of ["Hasil", "Responden", "Formulir"]) expect(html).toContain(label);
    expect(html).not.toContain("Segera hadir");
    expect(html).not.toContain("Simpan perubahan");
  });

  describe("Hasil tab", () => {
    const renderHasil = (query: Record<string, string> = {}) =>
      SurveyDetailPage({
        params: Promise.resolve({ id: String(surveyId) }),
        searchParams: Promise.resolve(query),
      });

    it("shows the response rate, non-respondents and per-question results to the owner admin", async () => {
      mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.branch) });

      const html = renderToStaticMarkup(await renderHasil());

      expect(html).toContain("Tingkat respons");
      expect(html).toContain("Belum mengisi");
      expect(html).toContain("Siap berpuasa?");
      expect(html).toContain("Pertanyaan lama");
      expect(html).toContain("Diarsipkan");
      expect(html).toContain("Belum ada jawaban");
      expect(html).toContain("Data dalam cakupan Anda");
    });

    it("counts only the viewer's own group for a USER below the owner", async () => {
      mockAuthSession(auth, { user: sessionFor(fx.actorId, "USER", fx.leaf) });

      const html = renderToStaticMarkup(await renderHasil());

      expect(html).toContain("Tingkat respons");
      expect(html).not.toContain("Warga Cabang");
    });

    it("narrows every figure with a demographic filter", async () => {
      mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.branch) });

      const html = renderToStaticMarkup(await renderHasil({ jk: "P" }));

      // Only "Warga Cabang" (P) remains; the male fixture member is filtered out of the population.
      expect(html).toContain("1 dari 1 anggota aktif");
      expect(html).not.toContain("2 dari 2 anggota aktif");
    });

    it("ignores an invalid filter value", async () => {
      mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.branch) });

      const plain = renderToStaticMarkup(await renderHasil());
      const invalid = renderToStaticMarkup(await renderHasil({ jk: "X" }));

      expect(invalid).toContain("Tingkat respons");
      expect(invalid.match(/\d+ dari \d+ anggota aktif/)?.[0]).toBe(plain.match(/\d+ dari \d+ anggota aktif/)?.[0]);
    });

    it("responds 404 when the selected group is outside the viewer's scope", async () => {
      mockAuthSession(auth, { user: sessionFor(fx.actorId, "USER", fx.leaf) });

      await expect(renderHasil({ grup: String(fx.otherLeaf.id) })).rejects.toMatchObject({
        digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404"),
      });
    });

    it("breaks results down per direct sub-group when the group has children", async () => {
      mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.branch) });

      const html = renderToStaticMarkup(await renderHasil());

      expect(html).toContain("Per sub-grup");
    });
  });

  it("shows the editable form to the owner admin, with answered questions locked and archived ones restorable", async () => {
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.branch) });

    const html = renderToStaticMarkup(await render("formulir"));

    expect(html).toContain("Simpan perubahan");
    expect(html).toContain("Tambah pertanyaan");
    // Input values are filled client-side (uncontrolled fields), so only structure is asserted here.
    expect(html).toContain("Sudah ada jawaban: jenis");
    expect(html).toContain("Arsipkan pertanyaan 1");
    expect(html).toContain("Pertanyaan lama");
    expect(html).toContain("Pulihkan");
    expect(html).not.toContain("hanya bisa diubah oleh admin");
  });

  it("shows a read-only form without save controls to a USER below the owner", async () => {
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "USER", fx.leaf) });

    const html = renderToStaticMarkup(await render("formulir"));

    expect(html).toContain("Diwarisi");
    expect(html).toContain("hanya bisa diubah oleh admin Branch");
    expect(html).not.toContain("Simpan perubahan");
    expect(html).not.toContain("Tambah pertanyaan");
    expect(html).not.toContain("Pulihkan");
  });

  it("is read-only for an ancestor admin too", async () => {
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "OWNER", fx.root) });

    const html = renderToStaticMarkup(await render("formulir"));

    expect(html).toContain("hanya bisa diubah oleh admin Branch");
    expect(html).not.toContain("Simpan perubahan");
  });

  describe("Responden tab", () => {
    const renderTab = (query: Record<string, string> = {}) =>
      SurveyDetailPage({
        params: Promise.resolve({ id: String(surveyId) }),
        searchParams: Promise.resolve({ tab: "responden", ...query }),
      });

    it("lists respondents in the owner's subtree with edit and delete controls", async () => {
      mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.branch) });

      const html = renderToStaticMarkup(await renderTab());

      expect(html).toContain("Anggota Uji");
      expect(html).toContain("Warga Cabang");
      expect(html).toContain(`/survei/${surveyId}/isi?anggota=${fx.memberId}`);
      expect(html).toContain("Hapus respons Anggota Uji");
      expect(html).not.toContain("Segera hadir");
    });

    it("shows a USER only the respondents of their own group", async () => {
      mockAuthSession(auth, { user: sessionFor(fx.actorId, "USER", fx.leaf) });

      const html = renderToStaticMarkup(await renderTab());

      expect(html).toContain("Anggota Uji");
      expect(html).not.toContain("Warga Cabang");
    });

    it("filters by name search", async () => {
      mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.branch) });

      const html = renderToStaticMarkup(await renderTab({ q: "warga" }));

      expect(html).toContain("Warga Cabang");
      expect(html).not.toContain("Anggota Uji");
    });

    it("gives users above the owning group a view-only list", async () => {
      mockAuthSession(auth, { user: sessionFor(fx.actorId, "OWNER", fx.root) });

      const html = renderToStaticMarkup(await renderTab());

      expect(html).toContain("Anggota Uji");
      expect(html).not.toContain("Hapus respons");
      expect(html).not.toContain("/isi?anggota=");
    });

    it("says so when nothing matches", async () => {
      mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.branch) });

      const html = renderToStaticMarkup(await renderTab({ q: "tidak-ada" }));

      expect(html).toContain("Tidak ada responden yang cocok.");
    });
  });

  it("responds 404 for a survey owned by an unrelated group", async () => {
    const other = await db.survey.create({
      data: { groupId: fx.otherLeaf.id, createdById: fx.actorId, title: "Cabang lain" },
    });
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.leaf) });

    await expect(
      SurveyDetailPage({ params: Promise.resolve({ id: String(other.id) }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404") });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(render()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });
});
