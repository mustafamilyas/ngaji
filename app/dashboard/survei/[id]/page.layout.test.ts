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

/** Class attribute of the first tag matching `tagPattern`. */
function classOf(html: string, tagPattern: RegExp): string {
  const tag = html.match(tagPattern)?.[0] ?? "";
  return tag.match(/class="([^"]*)"/)?.[1] ?? "";
}

describe("SurveyDetailPage phone and tablet layout", () => {
  let fx: PageFixture;
  let surveyId: number;

  beforeAll(async () => {
    fx = await buildPageFixture("survei-detail-layout");
    const survey = await db.survey.create({
      data: {
        groupId: fx.branch.id,
        createdById: fx.actorId,
        title: "Tata Letak",
        questions: {
          create: [
            {
              order: 0,
              type: "SINGLE_CHOICE",
              label: "Siap?",
              options: { create: [{ order: 0, label: "Ya" }, { order: 1, label: "Tidak" }] },
            },
          ],
        },
      },
    });
    surveyId = survey.id;
    // Anggota Uji answered; Warga Belum has not.
    await db.surveyResponse.create({ data: { surveyId, memberId: fx.memberId, recordedById: fx.actorId } });
    await db.member.create({
      data: {
        groupId: fx.leaf.id,
        name: "Warga Belum",
        birthPlace: "Bandung",
        birthDate: "1999-05-05",
        sex: "P",
        address: "Jl. Uji No. 9",
        phone: "081200000019",
        maritalStatus: "BELUM_MENIKAH",
        workStatus: "BEKERJA",
        status: "AKTIF",
        joinedAt: "2024-01-01",
        createdById: fx.actorId,
      },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function render(tab?: string) {
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.branch) });
    return renderToStaticMarkup(
      await SurveyDetailPage({
        params: Promise.resolve({ id: String(surveyId) }),
        searchParams: Promise.resolve(tab ? { tab } : {}),
      }),
    );
  }

  it("lays the non-respondents out as cards below md, with a 44px Isi button", async () => {
    const html = await render();

    expect(html).toMatch(/<table[^>]*class="[^"]*\bblock\b[^"]*\bmd:table\b/);
    expect(html).toMatch(/<tr\b[^>]*class="[^"]*\bgrid\b[^"]*\bmd:table-row\b/);
    expect(html).toMatch(/<span[^>]*class="[^"]*\bmd:hidden\b[^"]*"[^>]*>Grup<\/span>/);
    expect(classOf(html, /<a[^>]*aria-label="Isi survei untuk Warga Belum"[^>]*>/)).toMatch(/\bh-11\b.*\bxl:h-/);
  });

  it("lays the respondents out as cards below md, with 44px edit and delete buttons", async () => {
    const html = await render("responden");

    expect(html).toMatch(/<table[^>]*class="[^"]*\bblock\b[^"]*\bmd:table\b/);
    expect(html).toMatch(/<tr\b[^>]*class="[^"]*\bgrid\b[^"]*\bmd:table-row\b/);
    for (const label of ["Grup", "Disimpan oleh", "Waktu"]) {
      expect(html).toMatch(new RegExp(`<span[^>]*class="[^"]*\\bmd:hidden\\b[^"]*"[^>]*>${label}</span>`));
    }
    expect(classOf(html, /<a[^>]*aria-label="Ubah respons Anggota Uji"[^>]*>/)).toMatch(/\bsize-11\b.*\bxl:size-8\b/);
    expect(classOf(html, /<button[^>]*aria-label="Hapus respons Anggota Uji"[^>]*>/)).toMatch(/\bsize-11\b.*\bxl:size-8\b/);
  });
});
