import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { createActivity } from "@/lib/activity/mutations";
import { addDays, daysBetween, monthEndOf, monthStartOf, sundayOf, today, weekdayOf } from "@/lib/dates";
import { db } from "@/lib/db";
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
      weekdays: [weekdayOf(today())],
      startsOn: addDays(today(), -30),
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
      weekdays: [weekdayOf(today())],
      startsOn: addDays(today(), -30),
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
    expect(html).toContain(`${today()} – ${today()}`);
  });

  it("computes the calendar month bounds for range=bulan", async () => {
    const fixture = await buildPageFixture("kegiatan-list-range-bulan");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityListPage({ searchParams: Promise.resolve({ range: "bulan" }) }),
    );
    expect(html).toContain(`${monthStartOf(today())} – ${monthEndOf(today())}`);
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
    expect(html).toContain("2024-01-01 – 2024-01-31");
  });

  it("renders the calendar view with the expected number of day cells and occurrence badges", async () => {
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
      startsOn: today(),
      endsOn: today(),
    });

    const session = sessionFor(fixture.actorId, "ADMIN", fixture.leaf);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityListPage({ searchParams: Promise.resolve({ view: "calendar" }) }),
    );

    const month = sundayOf(today());
    const gridStart = sundayOf(monthStartOf(month));
    const gridEnd = addDays(sundayOf(monthEndOf(month)), 6);
    const expectedCells = daysBetween(gridStart, gridEnd) + 1;

    expect((html.match(/min-h-16/g) ?? []).length).toBe(expectedCells);
    expect(html).toContain("Kajian Cabang");
    expect(html).toContain("warisan");
  });
});
