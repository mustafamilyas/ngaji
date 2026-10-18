import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { createActivity } from "@/lib/activity/mutations";
import { overrideOccurrence } from "@/lib/activity/occurrence-mutations";
import * as listModule from "@/lib/activity/list";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import PrintSchedulePage from "./page";

const RANGE = { range: "custom", from: "2026-03-01", to: "2026-03-31" };

async function weeklyActivity(fixture: Awaited<ReturnType<typeof buildPageFixture>>, name: string) {
  const admin = sessionFor(fixture.actorId, "ADMIN", fixture.leaf);
  const { activity } = await createActivity(admin, {
    groupId: fixture.leaf.id,
    name,
    location: "Aula",
    startTime: "19:00",
    durationMinutes: 60,
    freq: "WEEKLY",
    interval: 1,
    weekdays: [1], // Monday: 2026-03-02, 09, 16, 23, 30
    startsOn: "2026-01-05",
  });
  return { admin, activity };
}

describe("PrintSchedulePage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(PrintSchedulePage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("renders every occurrence of the range without pagination", async () => {
    const fixture = await buildPageFixture("cetak-all");
    const { admin } = await weeklyActivity(fixture, "Kajian Cetak");
    mockAuthSession(auth, { user: admin });

    const html = renderToStaticMarkup(await PrintSchedulePage({ searchParams: Promise.resolve(RANGE) }));
    expect((html.match(/Kajian Cetak/g) ?? []).length).toBe(5);
    expect(html).toContain("19:00–20:00");
  });

  it("drops an out-of-scope group id", async () => {
    const mine = await buildPageFixture("cetak-scope-a");
    const other = await buildPageFixture("cetak-scope-b");
    const { admin } = await weeklyActivity(mine, "Kajian Milik Saya");
    await weeklyActivity(other, "Rahasia Org Lain");
    mockAuthSession(auth, { user: admin });

    const html = renderToStaticMarkup(
      await PrintSchedulePage({ searchParams: Promise.resolve({ ...RANGE, grup: `${mine.leaf.id},${other.leaf.id}` }) }),
    );
    expect(html).toContain("Kajian Milik Saya");
    expect(html).not.toContain("Rahasia Org Lain");
  });

  it("responds 404 when every group id is out of scope", async () => {
    const mine = await buildPageFixture("cetak-404-a");
    const other = await buildPageFixture("cetak-404-b");
    mockAuthSession(auth, { user: sessionFor(mine.actorId, "ADMIN", mine.leaf) });

    await expect(
      PrintSchedulePage({ searchParams: Promise.resolve({ ...RANGE, grup: String(other.leaf.id) }) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404") });
  });

  it("shows cancelled occurrences by default and hides them with batal=0", async () => {
    const fixture = await buildPageFixture("cetak-batal");
    const { admin, activity } = await weeklyActivity(fixture, "Kajian Batal");
    await overrideOccurrence(admin, { activityId: activity.id, date: "2026-03-09", status: "CANCELLED" });
    mockAuthSession(auth, { user: admin });

    const shown = renderToStaticMarkup(await PrintSchedulePage({ searchParams: Promise.resolve(RANGE) }));
    expect(shown).toContain("Batal");
    expect((shown.match(/Kajian Batal/g) ?? []).length).toBe(5);

    const hidden = renderToStaticMarkup(await PrintSchedulePage({ searchParams: Promise.resolve({ ...RANGE, batal: "0" }) }));
    expect((hidden.match(/Kajian Batal/g) ?? []).length).toBe(4);
  });

  it("rejects a range over 3 months without querying", async () => {
    const fixture = await buildPageFixture("cetak-long");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
    const spy = vi.spyOn(listModule, "listActivityOccurrences");

    const html = renderToStaticMarkup(
      await PrintSchedulePage({ searchParams: Promise.resolve({ range: "custom", from: "2026-01-01", to: "2026-04-01" }) }),
    );
    expect(html).toContain("paling lama 3 bulan");
    expect(html).not.toContain("<table");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
