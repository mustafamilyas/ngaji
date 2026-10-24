import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { createActivity } from "@/lib/activity/mutations";
import { overrideOccurrence } from "@/lib/activity/occurrence-mutations";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import ActivityListPage from "./page";

const RANGE = { range: "custom", from: "2026-03-01", to: "2026-03-31" };
const NOTES_MARKER = "data-occurrence-notes";
const count = (html: string, text: string) => html.split(text).length - 1;

type Fixture = Awaited<ReturnType<typeof buildPageFixture>>;

/** Mondays in March 2026: 02, 09, 16, 23, 30. */
async function weekly(fixture: Fixture, owner: "leaf" | "branch", name: string, notes?: string) {
  const group = fixture[owner];
  const admin = sessionFor(fixture.actorId, "ADMIN", group);
  const { activity } = await createActivity(admin, {
    groupId: group.id,
    name,
    location: "Aula",
    notes,
    startTime: "19:00",
    durationMinutes: 60,
    freq: "WEEKLY",
    interval: 1,
    weekdays: [1],
    startsOn: "2026-01-05",
  });
  return { admin, activity };
}

async function render(session: ReturnType<typeof sessionFor>, params: Record<string, string> = {}) {
  mockAuthSession(auth, { user: session });
  return renderToStaticMarkup(await ActivityListPage({ searchParams: Promise.resolve({ ...RANGE, ...params }) }));
}

describe("ActivityListPage Keterangan", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("shows per-date notes on that row only", async () => {
    const fixture = await buildPageFixture("notes-per-date");
    const { admin, activity } = await weekly(fixture, "leaf", "Pengajian Rutin");
    await overrideOccurrence(admin, {
      activityId: activity.id,
      date: "2026-03-09",
      status: "SCHEDULED",
      overrideNotes: "Pengajar: Ilyas, Materi: Adab",
    });

    const html = await render(admin);

    expect(count(html, "Pengajar: Ilyas, Materi: Adab")).toBe(1);
    expect(count(html, NOTES_MARKER)).toBe(1);
  });

  it("falls back to the activity notes for occurrences without their own, and an own note wins on its date", async () => {
    const fixture = await buildPageFixture("notes-fallback");
    const { admin, activity } = await weekly(fixture, "leaf", "Kajian Bawaan", "Bawa Al-Qur'an");
    await overrideOccurrence(admin, {
      activityId: activity.id,
      date: "2026-03-16",
      status: "SCHEDULED",
      overrideNotes: "Materi khusus",
    });

    const html = await render(admin);

    expect(count(html, "Materi khusus")).toBe(1);
    expect(count(html, "Bawa Al-Qur&#x27;an")).toBe(4);
  });

  it("shows nothing when both the occurrence and the activity have no notes", async () => {
    const fixture = await buildPageFixture("notes-empty");
    const { admin } = await weekly(fixture, "leaf", "Tanpa Keterangan");

    const html = await render(admin);

    expect(html).toContain("Tanpa Keterangan");
    expect(count(html, NOTES_MARKER)).toBe(0);
  });

  it("renders markup in notes as literal text", async () => {
    const fixture = await buildPageFixture("notes-markup");
    const { admin } = await weekly(fixture, "leaf", "Kajian Markup", "<b>Materi</b>");

    const html = await render(admin);

    expect(html).toContain("&lt;b&gt;Materi&lt;/b&gt;");
    expect(html).not.toContain("<b>Materi");
  });

  it("keeps long notes complete in the markup, clamped by CSS and expandable by tap", async () => {
    const fixture = await buildPageFixture("notes-long");
    const long = "Materi panjang ".repeat(12).trim();
    const { admin } = await weekly(fixture, "leaf", "Kajian Panjang", long);

    const html = await render(admin);

    expect(html).toContain(long);
    expect(html).toContain("<details");
    expect(html).toContain("line-clamp-2");
    expect(html).toContain("Selengkapnya");
  });

  it("offers no expand control for short notes", async () => {
    const fixture = await buildPageFixture("notes-short");
    const { admin } = await weekly(fixture, "leaf", "Kajian Pendek", "Bawa mushaf");

    const html = await render(admin);

    expect(html).toContain("Bawa mushaf");
    expect(html).not.toContain("Selengkapnya");
  });

  it("shows notes in the calendar entry, also as a tooltip with the full text", async () => {
    const fixture = await buildPageFixture("notes-calendar");
    const { admin, activity } = await weekly(fixture, "leaf", "Kajian Kalender");
    await overrideOccurrence(admin, {
      activityId: activity.id,
      date: "2026-03-23",
      status: "SCHEDULED",
      overrideNotes: "Pengajar: Ilyas",
    });

    const html = await render(admin, { view: "calendar" });

    expect(count(html, "Pengajar: Ilyas")).toBe(2); // visible text + title attribute
    expect(count(html, NOTES_MARKER)).toBe(1);
    expect(html).toContain('title="Pengajar: Ilyas"');
  });

  it("renders markup in calendar notes as literal text", async () => {
    const fixture = await buildPageFixture("notes-calendar-markup");
    const { admin } = await weekly(fixture, "leaf", "Kalender Markup", "<i>x</i>");

    const html = await render(admin, { view: "calendar" });

    expect(html).toContain("&lt;i&gt;x&lt;/i&gt;");
    expect(html).not.toContain("<i>x");
  });

  it("shows inherited notes to a USER in a descendant group", async () => {
    const fixture = await buildPageFixture("notes-inherited");
    await weekly(fixture, "branch", "Kajian Cabang", "Catatan cabang");
    const user = sessionFor(fixture.actorId, "USER", fixture.leaf);

    const html = await render(user);

    expect(html).toContain("Kajian Cabang");
    expect(count(html, "Catatan cabang")).toBe(5);
  });

  it("does not show notes of an activity outside the user's scope", async () => {
    const fixture = await buildPageFixture("notes-out-of-scope");
    await weekly(fixture, "leaf", "Kajian Leaf Saja", "Rahasia leaf");
    const otherLeafUser = sessionFor(fixture.actorId, "USER", fixture.otherLeaf);

    const html = await render(otherLeafUser);

    expect(html).not.toContain("Kajian Leaf Saja");
    expect(html).not.toContain("Rahasia leaf");
  });

  it("lays the list out as stacked rows below md and as a table from md, in the same markup", async () => {
    const fixture = await buildPageFixture("notes-stacked");
    const { admin } = await weekly(fixture, "leaf", "Kajian Bertumpuk", "Bawa mushaf");

    const html = await render(admin);

    expect(html).toMatch(/<table[^>]*class="[^"]*\bblock\b[^"]*\bmd:table\b/);
    expect(html).toMatch(/<thead[^>]*class="[^"]*\bhidden\b[^"]*\bmd:table-header-group\b/);
    expect(html).toMatch(/<tbody[^>]*class="[^"]*\bblock\b[^"]*\bmd:table-row-group\b/);
    const rows = html.match(/<tr\b[^>]*class="[^"]*"[^>]*>/g) ?? [];
    const bodyRows = rows.filter((tag) => tag.includes("md:table-row") && tag.includes("grid"));
    expect(bodyRows).toHaveLength(5);
    expect(count(html, ">Kajian Bertumpuk</a>")).toBe(5);
    expect(html).toMatch(/aria-label="Aksi untuk Kajian Bertumpuk[^"]*"[^>]*class="[^"]*\bsize-11\b[^"]*\bxl:size-8\b/);
  });

  it("shows marker dots instead of text lines in calendar cells below sm", async () => {
    const fixture = await buildPageFixture("notes-calendar-dots");
    const { admin, activity } = await weekly(fixture, "leaf", "Kajian Titik");
    await overrideOccurrence(admin, {
      activityId: activity.id,
      date: "2026-03-23",
      status: "SCHEDULED",
      overrideNotes: "Pengajar: Ilyas",
    });

    const html = await render(admin, { view: "calendar" });

    expect(count(html, "data-day-dots")).toBe(5); // one per Monday with an occurrence
    expect(count(html, "data-notes-marker")).toBe(1); // only 03-23 has notes
    expect(html).toMatch(/class="hidden flex-col gap-0\.5 sm:flex"[^>]*>(?:(?!<\/a>).)*data-occurrence-notes/); // text lines only from sm
  });
});
