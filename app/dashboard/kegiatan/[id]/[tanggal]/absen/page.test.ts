import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_TIMEZONE } from "@/lib/validation/enums";

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
import { addDays, today, weekdayOf } from "@/lib/dates";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import CheckInPage from "./page";

describe("CheckInPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the activity name, name field and the new-member CTA", async () => {
    const fixture = await buildPageFixture("kegiatan-absen");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.leaf) });

    const html = renderToStaticMarkup(
      await CheckInPage({
        params: Promise.resolve({ id: String(fixture.activityId), tanggal: today(DEFAULT_TIMEZONE) }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("Kajian Uji");
    expect(html).toContain("check-in-name");
    // Leaf-owned activity: the owner's leaf group is preselected in the (always shown) group field.
    expect(html).toContain("check-in-group");
    expect(html).toContain("Leaf");
    expect(html).toContain("Daftar sebagai anggota baru");
  });

  it("offers only the allowed leaf groups for a non-leaf activity", async () => {
    const fixture = await buildPageFixture("kegiatan-absen-nonleaf");
    const activity = await db.activity.create({
      data: {
        groupId: fixture.branch.id,
        name: "Kajian Cabang",
        location: "Aula",
        startTime: "19:00",
        durationMinutes: 60,
        freq: "WEEKLY",
        interval: 1,
        weekdays: [weekdayOf(today(DEFAULT_TIMEZONE))],
        startsOn: addDays(today(DEFAULT_TIMEZONE), -30),
        createdById: fixture.actorId,
      },
    });
    // A leaf elsewhere in the tree must never be offered.
    const stray = await db.group.create({
      data: { organizationId: fixture.organizationId, parentId: fixture.root.id, depth: 2, name: "Stray Leaf", path: "9999/" },
    });
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.branch) });

    const html = renderToStaticMarkup(
      await CheckInPage({
        params: Promise.resolve({ id: String(activity.id), tanggal: today(DEFAULT_TIMEZONE) }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("check-in-group");
    expect(html).not.toContain("Stray Leaf");
    void stray;
  });

  it("redirects a session above the owning group to the read-only page", async () => {
    const fixture = await buildPageFixture("kegiatan-absen-above");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });

    await expect(
      CheckInPage({
        params: Promise.resolve({ id: String(fixture.activityId), tanggal: today(DEFAULT_TIMEZONE) }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });

  describe("future dates (task 6.2)", () => {
    async function renderFuture(role: "USER" | "ADMIN" | "OWNER") {
      const fixture = await buildPageFixture(`kegiatan-absen-future-${role}`);
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, role, fixture.leaf) });
      return renderToStaticMarkup(
        await CheckInPage({
          params: Promise.resolve({ id: String(fixture.activityId), tanggal: addDays(today(DEFAULT_TIMEZONE), 7) }),
          searchParams: Promise.resolve({}),
        }),
      );
    }

    it.each(["ADMIN", "OWNER"] as const)("shows an %s the form with a not-yet notice", async (role) => {
      const html = await renderFuture(role);
      expect(html).toContain("check-in-name");
      expect(html).toContain("Tanggal ini belum terjadi. Sebagai admin Anda tetap bisa mengisi absensi");
      expect(html).not.toContain("absensi belum bisa diisi");
    });

    it("shows a USER the closed message without the form", async () => {
      const html = await renderFuture("USER");
      expect(html).toContain("Tanggal ini belum terjadi; absensi belum bisa diisi.");
      expect(html).not.toContain("check-in-name");
    });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(
      CheckInPage({ params: Promise.resolve({ id: "1", tanggal: today(DEFAULT_TIMEZONE) }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });
});
