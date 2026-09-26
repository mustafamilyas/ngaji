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
import { today } from "@/lib/dates";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import AttendancePage from "./page";

describe("AttendancePage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the attendance form for today's occurrence without crashing", async () => {
    const fixture = await buildPageFixture("kegiatan-absensi");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await AttendancePage({
        params: Promise.resolve({ id: String(fixture.activityId), tanggal: today() }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("Anggota Uji");
  });

  it("renders the read-only notice for a session outside the recording scope", async () => {
    const fixture = await buildPageFixture("kegiatan-absensi-out-of-scope");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await AttendancePage({
        params: Promise.resolve({ id: String(fixture.activityId), tanggal: today() }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("tidak bisa mengisi absensi");
  });

  it("404s for a malformed date", async () => {
    const fixture = await buildPageFixture("kegiatan-absensi-bad-date");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    await expect(
      AttendancePage({
        params: Promise.resolve({ id: String(fixture.activityId), tanggal: "not-a-date" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(
      AttendancePage({
        params: Promise.resolve({ id: "1", tanggal: today() }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });
});
