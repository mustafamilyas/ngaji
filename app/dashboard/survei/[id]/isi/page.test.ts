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
import SurveyEntryPage from "./page";

describe("SurveyEntryPage", () => {
  let fx: PageFixture;
  let surveyId: number;

  beforeAll(async () => {
    fx = await buildPageFixture("survei-isi");
    const survey = await db.survey.create({
      data: {
        groupId: fx.branch.id,
        createdById: fx.actorId,
        title: "Kesiapan Ramadhan",
        questions: {
          create: [
            {
              order: 0,
              type: "SINGLE_CHOICE",
              label: "Siap berpuasa?",
              required: true,
              options: { create: [{ order: 0, label: "Ya" }, { order: 1, label: "Tidak" }] },
            },
            { order: 1, type: "SCALE", label: "Semangat", scaleMin: 1, scaleMax: 5 },
            { order: 2, type: "LONG_TEXT", label: "Catatan", helpText: "Boleh kosong" },
          ],
        },
      },
      include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
    });
    surveyId = survey.id;
    const response = await db.surveyResponse.create({
      data: { surveyId, memberId: fx.memberId, recordedById: fx.actorId },
    });
    await db.surveyAnswer.create({
      data: { responseId: response.id, questionId: survey.questions[0].id, optionId: survey.questions[0].options[0].id },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  function render(anggota?: string) {
    return SurveyEntryPage({
      params: Promise.resolve({ id: String(surveyId) }),
      searchParams: Promise.resolve(anggota ? { anggota } : {}),
    });
  }

  it("shows only the member picker until a member is chosen", async () => {
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "USER", fx.leaf) });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Isi survei");
    expect(html).toContain("Anggota");
    expect(html).not.toContain("Siap berpuasa?");
    expect(html).not.toContain("Simpan &amp; anggota berikutnya");
  });

  it("renders every question and the save button for a preselected member, prefilled", async () => {
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "USER", fx.leaf) });

    const html = renderToStaticMarkup(await render(String(fx.memberId)));

    for (const text of ["Siap berpuasa?", "Semangat", "Catatan", "Boleh kosong", "Ya", "Tidak", "Mengubah jawaban"]) {
      expect(html).toContain(text);
    }
    expect(html).toContain("Simpan &amp; anggota berikutnya");
    expect(html).toMatch(/type="radio"[^>]*checked/);
  });

  it("ignores a member id outside the caller's scope", async () => {
    const stranger = await db.member.create({
      data: {
        groupId: fx.otherLeaf.id, name: "Orang Lain", birthPlace: "X", birthDate: "2000-01-01", sex: "L",
        address: "-", phone: "0", maritalStatus: "BELUM_MENIKAH", workStatus: "BEKERJA", status: "AKTIF",
        joinedAt: "2024-01-01", createdById: fx.actorId,
      },
    });
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "USER", fx.leaf) });

    const html = renderToStaticMarkup(await render(String(stranger.id)));

    expect(html).not.toContain("Siap berpuasa?");
    expect(html).not.toContain("Orang Lain");
  });

  it("redirects a user above the owning group back to the survey", async () => {
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "OWNER", fx.root) });

    await expect(render()).rejects.toMatchObject({
      digest: expect.stringContaining(`NEXT_REDIRECT;replace;/dashboard/survei/${surveyId}`),
    });
  });

  it("responds 404 for a survey owned by an unrelated group", async () => {
    const other = await db.survey.create({
      data: { groupId: fx.otherLeaf.id, createdById: fx.actorId, title: "Cabang lain" },
    });
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.leaf) });

    await expect(
      SurveyEntryPage({ params: Promise.resolve({ id: String(other.id) }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404") });
  });

  it("redirects to /login without a session", async () => {
    mockAuthSession(auth, null);
    await expect(render()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });
});
