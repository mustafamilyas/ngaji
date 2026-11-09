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
import { today } from "@/lib/dates";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import AttendancePage from "./page";

async function render(fixture: Awaited<ReturnType<typeof buildPageFixture>>) {
  mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.leaf) });
  return renderToStaticMarkup(
    await AttendancePage({
      params: Promise.resolve({ id: String(fixture.activityId), tanggal: today(DEFAULT_TIMEZONE) }),
      searchParams: Promise.resolve({}),
    }),
  );
}

/** Class attribute of the first tag matching `tagPattern`. */
function classOf(html: string, tagPattern: RegExp): string {
  const tag = html.match(tagPattern)?.[0] ?? "";
  return tag.match(/class="([^"]*)"/)?.[1] ?? "";
}

describe("AttendancePage phone and tablet layout", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("lays each member out as a stacked row below md and as a table row from md", async () => {
    const html = await render(await buildPageFixture("absensi-layout-stacked"));

    expect(html).toMatch(/<table[^>]*class="[^"]*\bblock\b[^"]*\bmd:table\b/);
    expect(html).toMatch(/<thead[^>]*class="[^"]*\bhidden\b[^"]*\bmd:table-header-group\b/);
    expect(html).toMatch(/<tbody[^>]*class="[^"]*\bblock\b[^"]*\bmd:table-row-group\b/);
    const memberRow = classOf(html, /<tr\b[^>]*class="[^"]*\bgrid\b[^"]*"[^>]*>/);
    expect(memberRow).toContain("md:table-row");
  });

  it("gives the Hadir and Izin buttons a 44px tap size below xl", async () => {
    const html = await render(await buildPageFixture("absensi-layout-buttons"));

    for (const label of ["hadir", "izin"]) {
      const cls = classOf(html, new RegExp(`<button[^>]*aria-label="Tandai Anggota Uji ${label}"[^>]*>`));
      expect(cls).toMatch(/\bh-11\b/);
      expect(cls).toMatch(/\bxl:h-8\b/);
      expect(cls).toMatch(/\btext-base\b/);
    }
  });

  it("keeps the search and status filter at 44px and 16px text below xl", async () => {
    const html = await render(await buildPageFixture("absensi-layout-filters"));

    for (const tag of [/<input[^>]*aria-label="Cari nama anggota"[^>]*>/, /<select[^>]*aria-label="Filter status"[^>]*>/]) {
      const cls = classOf(html, tag);
      expect(cls).toMatch(/\bh-11\b/);
      expect(cls).toMatch(/\btext-base\b/);
    }
  });

  it("makes the reason field 44px with 16px text below xl", async () => {
    const fixture = await buildPageFixture("absensi-layout-reason");
    const occurrence = await db.activityOccurrence.create({
      data: { activityId: fixture.activityId, date: today(DEFAULT_TIMEZONE) },
    });
    await db.attendance.create({
      data: { occurrenceId: occurrence.id, memberId: fixture.memberId, status: "IZIN", note: "Sakit", recordedById: fixture.actorId },
    });

    const html = await render(fixture);

    const cls = classOf(html, /<input[^>]*aria-label="Alasan izin Anggota Uji"[^>]*>/);
    expect(cls).toMatch(/\bh-11\b/);
    expect(cls).toMatch(/\btext-base\b/);
  });

  it("makes the check-in button and breadcrumb links 44px tall below xl", async () => {
    const html = await render(await buildPageFixture("absensi-layout-header"));

    expect(classOf(html, /<a[^>]*href="[^"]*\/absen[^"]*"[^>]*>/)).toMatch(/\bh-11\b/);
    expect(classOf(html, /<a[^>]*href="\/dashboard\/kegiatan"[^>]*>/)).toMatch(/\bmin-h-11\b/);
  });

  it("makes the sort buttons 44px tall below xl", async () => {
    const html = await render(await buildPageFixture("absensi-layout-sort"));

    const sortButton = html.match(/<button[^>]*type="button"[^>]*>\s*Nama/)?.[0] ?? "";
    expect(sortButton).toMatch(/\bmin-h-11\b/);
  });
});
