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
import NewSurveyPage from "./page";

describe("NewSurveyPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the survey builder with title, question fields and the Ya/Tidak preset", async () => {
    const fixture = await buildPageFixture("survei-baru");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.branch) });

    const html = renderToStaticMarkup(await NewSurveyPage());

    expect(html).toContain("Survei baru");
    expect(html).toContain("Judul");
    expect(html).toContain("Pertanyaan 1");
    expect(html).toContain("Tambah Ya/Tidak");
    expect(html).toContain("Simpan survei");
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(NewSurveyPage()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
