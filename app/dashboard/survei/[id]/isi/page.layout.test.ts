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

describe("SurveyEntryPage text sizes", () => {
  let fx: PageFixture;
  let surveyId: number;

  beforeAll(async () => {
    fx = await buildPageFixture("survei-isi-layout");
    const survey = await db.survey.create({
      data: {
        groupId: fx.branch.id,
        createdById: fx.actorId,
        title: "Ukuran Teks",
        questions: {
          create: [
            { order: 0, type: "NUMBER", label: "Jumlah" },
            { order: 1, type: "SHORT_TEXT", label: "Nama panggilan" },
            { order: 2, type: "LONG_TEXT", label: "Catatan" },
          ],
        },
      },
    });
    surveyId = survey.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("keeps the answer fields at 16px text from md up to xl, so iPad Safari does not zoom", async () => {
    mockAuthSession(auth, { user: sessionFor(fx.actorId, "ADMIN", fx.branch) });
    const html = renderToStaticMarkup(
      await SurveyEntryPage({
        params: Promise.resolve({ id: String(surveyId) }),
        searchParams: Promise.resolve({ anggota: String(fx.memberId) }),
      }),
    );

    for (const tag of [/<input[^>]*type="number"[^>]*>/, /<input[^>]*aria-label="Nama panggilan"[^>]*>/, /<textarea[^>]*>/]) {
      const cls = (html.match(tag)?.[0] ?? "").match(/class="([^"]*)"/)?.[1] ?? "";
      expect(cls, String(tag)).toMatch(/\btext-base\b/);
      expect(cls, String(tag)).toMatch(/\bmd:text-base\b/);
      expect(cls, String(tag)).not.toMatch(/\bmd:text-sm\b/);
    }
  });
});
