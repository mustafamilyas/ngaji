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
    expect(html).toContain("Segera hadir");
    expect(html).not.toContain("Simpan perubahan");
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
