import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_TIMEZONE } from "@/lib/validation/enums";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { createActivity } from "@/lib/activity/mutations";
import { addDays, daysBetween, monthEndOf, monthStartOf, sundayOf, today, weekdayOf } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatDateRange } from "@/lib/filters";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import ActivityListPage from "./page";

describe("ActivityListPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the default (this week) range without crashing", async () => {
    const fixture = await buildPageFixture("kegiatan-list");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(await ActivityListPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Kajian Uji");
  });

  it("renders an explicit date range and group filter without crashing", async () => {
    const fixture = await buildPageFixture("kegiatan-list-filters");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityListPage({
        searchParams: Promise.resolve({ from: "2024-01-01", to: "2024-01-31", grup: String(fixture.leaf.id) }),
      }),
    );
    expect(html).toContain("Kegiatan");
  });

  describe("tag filter control (task 5.6)", () => {
    it("offers the visible tags, shows the selection in the trigger, and drops ids the user cannot see", async () => {
      const fixture = await buildPageFixture("activities-tag-filter-ui");
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });
      const mine = await db.tag.create({ data: { groupId: fixture.root.id, key: "filter-ui-satu", color: "blue", createdById: fixture.actorId } });
      const other = await buildPageFixture("activities-tag-filter-ui-other");
      const foreign = await db.tag.create({ data: { groupId: other.root.id, key: "filter-ui-asing", color: "red", createdById: other.actorId } });

      const html = renderToStaticMarkup(await ActivityListPage({ searchParams: Promise.resolve({ tag: `${mine.id},${foreign.id}` }) }));
      expect(html).toContain('data-slot="tag-filter"');
      expect(html).toContain("filter-ui-satu");
      expect(html).not.toContain("filter-ui-asing");
      expect(html).toContain(`value="${mine.id}"`);
    });

    it("hides the tag filter when the user sees no tag at all", async () => {
      const fixture = await buildPageFixture("activities-tag-filter-none");
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });

      const html = renderToStaticMarkup(await ActivityListPage({ searchParams: Promise.resolve({}) }));
      expect(html).not.toContain('data-slot="tag-filter"');
    });
  });

  it("filters by the tag param, dropping ids the user cannot see", async () => {
    const fixture = await buildPageFixture("kegiatan-list-tag");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });
    const tag = await db.tag.create({ data: { groupId: fixture.root.id, key: "fokus", color: "blue", createdById: fixture.actorId } });
    const other = await buildPageFixture("kegiatan-list-tag-other");
    const foreign = await db.tag.create({ data: { groupId: other.root.id, key: "asing", color: "red", createdById: other.actorId } });

    const without = renderToStaticMarkup(await ActivityListPage({ searchParams: Promise.resolve({ tag: String(tag.id) }) }));
    expect(without).not.toContain("Kajian Uji");

    await db.activityTag.create({ data: { activityId: fixture.activityId, tagId: tag.id, createdById: fixture.actorId } });
    const withTag = renderToStaticMarkup(
      await ActivityListPage({ searchParams: Promise.resolve({ tag: `${tag.id},${foreign.id}` }) }),
    );
    expect(withTag).toContain("Kajian Uji");
  });

  it("shows each row's visible tags with a compact picker (task 5.4)", async () => {
    const fixture = await buildPageFixture("kegiatan-list-tag-row");
    const usable = await db.tag.create({ data: { groupId: fixture.root.id, key: "fokus-baris", color: "blue", createdById: fixture.actorId } });
    await db.activityTag.create({ data: { activityId: fixture.activityId, tagId: usable.id, createdById: fixture.actorId } });

    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });
    const withPicker = renderToStaticMarkup(await ActivityListPage({ searchParams: Promise.resolve({}) }));
    expect(withPicker).toContain("fokus-baris");
    expect(withPicker).toContain("Atur tag Kajian Uji");
  });

  it("shows chips only when the user can neither use nor create any tag (task 5.4)", async () => {
    const fixture = await buildPageFixture("kegiatan-list-tag-row-ro");
    const below = await db.tag.create({ data: { groupId: fixture.leaf.id, key: "binaan-baris", color: "blue", createdById: fixture.actorId } });
    await db.activityTag.create({ data: { activityId: fixture.activityId, tagId: below.id, createdById: fixture.actorId } });
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.branch) });

    const readOnly = renderToStaticMarkup(await ActivityListPage({ searchParams: Promise.resolve({}) }));
    expect(readOnly).toContain("binaan-baris");
    expect(readOnly).not.toContain("Atur tag");
  });

  it("carries the tag filter into the Cetak link", async () => {
    const fixture = await buildPageFixture("kegiatan-list-tag-cetak");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
    const tag = await db.tag.create({ data: { groupId: fixture.root.id, key: "fokus", color: "blue", createdById: fixture.actorId } });

    const html = renderToStaticMarkup(await ActivityListPage({ searchParams: Promise.resolve({ tag: String(tag.id), q: "uji" }) }));
    const cetak = html.match(/href="(\/dashboard\/kegiatan\/cetak\?[^"]*)"/)?.[1] ?? "";
    expect(cetak).toContain(`tag=${tag.id}`);
    expect(cetak).toContain("q=uji");
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(ActivityListPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("shows activities from multiple selected groups", async () => {
    const fixture = await buildPageFixture("kegiatan-list-multi");
    const otherLeafAdmin = sessionFor(fixture.actorId, "ADMIN", fixture.otherLeaf);
    await createActivity(otherLeafAdmin, {
      groupId: fixture.otherLeaf.id,
      name: "Kajian Kelompok Lain",
      location: "Rumah Lain",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [weekdayOf(today(DEFAULT_TIMEZONE))],
      startsOn: addDays(today(DEFAULT_TIMEZONE), -30),
    });

    const branchAdmin = sessionFor(fixture.actorId, "ADMIN", fixture.branch);
    mockAuthSession(auth, { user: branchAdmin });

    const html = renderToStaticMarkup(
      await ActivityListPage({
        searchParams: Promise.resolve({ grup: `${fixture.leaf.id},${fixture.otherLeaf.id}` }),
      }),
    );

    expect(html).toContain("Kajian Uji");
    expect(html).toContain("Kajian Kelompok Lain");
  });

  it("ignores an out-of-scope group id mixed with a valid one, without crashing", async () => {
    const fixtureA = await buildPageFixture("kegiatan-list-scope-a");
    const fixtureB = await buildPageFixture("kegiatan-list-scope-b");

    const secretAdmin = sessionFor(fixtureB.actorId, "ADMIN", fixtureB.leaf);
    await createActivity(secretAdmin, {
      groupId: fixtureB.leaf.id,
      name: "Rahasia Org Lain",
      location: "Rahasia",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "WEEKLY",
      interval: 1,
      weekdays: [weekdayOf(today(DEFAULT_TIMEZONE))],
      startsOn: addDays(today(DEFAULT_TIMEZONE), -30),
    });

    const session = sessionFor(fixtureA.actorId, "ADMIN", fixtureA.leaf);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityListPage({
        searchParams: Promise.resolve({ grup: `${fixtureA.leaf.id},${fixtureB.leaf.id}` }),
      }),
    );

    expect(html).toContain("Kegiatan");
    expect(html).not.toContain("Rahasia Org Lain");
  });

  it("computes today's range for range=hari", async () => {
    const fixture = await buildPageFixture("kegiatan-list-range-hari");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityListPage({ searchParams: Promise.resolve({ range: "hari" }) }),
    );
    expect(html).toContain(formatDateRange(today(DEFAULT_TIMEZONE), today(DEFAULT_TIMEZONE)));
  });

  it("computes the calendar month bounds for range=bulan", async () => {
    const fixture = await buildPageFixture("kegiatan-list-range-bulan");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityListPage({ searchParams: Promise.resolve({ range: "bulan" }) }),
    );
    expect(html).toContain(formatDateRange(monthStartOf(today(DEFAULT_TIMEZONE)), monthEndOf(today(DEFAULT_TIMEZONE))));
  });

  it("keeps the given from/to as-is for range=custom", async () => {
    const fixture = await buildPageFixture("kegiatan-list-range-custom");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityListPage({
        searchParams: Promise.resolve({ range: "custom", from: "2024-01-01", to: "2024-01-31" }),
      }),
    );
    expect(html).toContain("1–31 Jan 2024");
  });

  it("renders the calendar of the default week range as an agenda of full activity entries", async () => {
    const fixture = await buildPageFixture("kegiatan-list-agenda");
    const branchAdmin = sessionFor(fixture.actorId, "ADMIN", fixture.branch);
    await createActivity(branchAdmin, {
      groupId: fixture.branch.id,
      name: "Kajian Cabang",
      location: "Aula Cabang",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "ONCE",
      interval: 1,
      weekdays: [],
      startsOn: today(DEFAULT_TIMEZONE),
      endsOn: today(DEFAULT_TIMEZONE),
    });

    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.leaf) });

    const html = renderToStaticMarkup(
      await ActivityListPage({ searchParams: Promise.resolve({ view: "calendar" }) }),
    );

    expect(html).not.toContain("min-h-16");
    expect(html).toContain("Kajian Cabang");
    expect(html).toContain("Aula Cabang");
    expect(html).toContain("Warisan");
    expect(html).toContain("Hari ini");
    expect((html.match(/Tidak ada kegiatan\./g) ?? []).length).toBe(6);
  });

  it("renders the calendar of a month range as a grid with the expected number of day cells", async () => {
    const fixture = await buildPageFixture("kegiatan-list-calendar");
    const branchAdmin = sessionFor(fixture.actorId, "ADMIN", fixture.branch);
    await createActivity(branchAdmin, {
      groupId: fixture.branch.id,
      name: "Kajian Cabang",
      location: "Aula Cabang",
      startTime: "19:00",
      durationMinutes: 60,
      freq: "ONCE",
      interval: 1,
      weekdays: [],
      startsOn: today(DEFAULT_TIMEZONE),
      endsOn: today(DEFAULT_TIMEZONE),
    });

    const session = sessionFor(fixture.actorId, "ADMIN", fixture.leaf);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityListPage({ searchParams: Promise.resolve({ view: "calendar", range: "bulan" }) }),
    );

    const month = today(DEFAULT_TIMEZONE);
    const gridStart = sundayOf(monthStartOf(month));
    const gridEnd = addDays(sundayOf(monthEndOf(month)), 6);
    const expectedCells = daysBetween(gridStart, gridEnd) + 1;

    expect((html.match(/min-h-16/g) ?? []).length).toBe(expectedCells);
    expect(html).toContain("Kajian Cabang");
    expect(html).toContain("warisan");
  });

  it("links Cetak to the print route with the current filters", async () => {
    const fixture = await buildPageFixture("kegiatan-list-cetak-link");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityListPage({
        searchParams: Promise.resolve({ grup: String(fixture.leaf.id), q: "uji", range: "custom", from: "2024-01-01", to: "2024-01-31", page: "1" }),
      }),
    );
    expect(html).toContain(
      `/dashboard/kegiatan/cetak?grup=${fixture.leaf.id}&amp;q=uji&amp;range=custom&amp;from=2024-01-01&amp;to=2024-01-31`,
    );
  });
});
