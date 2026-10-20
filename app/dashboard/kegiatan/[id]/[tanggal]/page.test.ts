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
import { addDays, today } from "@/lib/dates";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import AttendancePage from "./page";

describe("AttendancePage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the attendance table for today's occurrence with toggles", async () => {
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
    expect(html).toContain("Belum absen");
    expect(html).toContain("Tandai Anggota Uji hadir");
  });

  it("shows existing IZIN attendance with its reason", async () => {
    const fixture = await buildPageFixture("kegiatan-absensi-existing");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    const occurrence = await db.activityOccurrence.create({
      data: { activityId: fixture.activityId, date: today() },
    });
    await db.attendance.create({
      data: {
        occurrenceId: occurrence.id,
        memberId: fixture.memberId,
        status: "IZIN",
        note: "Sakit demam",
        recordedById: fixture.actorId,
      },
    });

    const html = renderToStaticMarkup(
      await AttendancePage({
        params: Promise.resolve({ id: String(fixture.activityId), tanggal: today() }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("Anggota Uji");
    expect(html).toContain("Sakit demam");
  });

  it("lets an ADMIN fill a future date but keeps it read-only for a USER", async () => {
    const fixture = await buildPageFixture("kegiatan-absensi-future");
    const render = async (role: "ADMIN" | "USER") => {
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, role, fixture.leaf) });
      return renderToStaticMarkup(
        await AttendancePage({
          params: Promise.resolve({ id: String(fixture.activityId), tanggal: addDays(today(), 7) }),
          searchParams: Promise.resolve({}),
        }),
      );
    };

    expect(await render("ADMIN")).toContain("Tandai Anggota Uji izin");
    const userHtml = await render("USER");
    expect(userHtml).toContain("absensi belum bisa diisi");
    expect(userHtml).not.toContain("Tandai Anggota Uji");
  });

  it("shows a read-only, cross-subtree view (including attendee names) for a session outside the recording scope", async () => {
    const fixture = await buildPageFixture("kegiatan-absensi-out-of-scope");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const occurrence = await db.activityOccurrence.create({
      data: { activityId: fixture.activityId, date: today() },
    });
    await db.attendance.create({
      data: { occurrenceId: occurrence.id, memberId: fixture.memberId, status: "HADIR", recordedById: fixture.actorId },
    });

    const html = renderToStaticMarkup(
      await AttendancePage({
        params: Promise.resolve({ id: String(fixture.activityId), tanggal: today() }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("tidak bisa mengisi absensi");
    expect(html).toContain("Anggota Uji");
    expect(html).not.toContain("Tandai Anggota Uji");
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
