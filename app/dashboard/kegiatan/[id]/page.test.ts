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
import { WEEKDAY_LABELS } from "@/lib/activity/labels";
import { addDays, today, weekdayOf } from "@/lib/dates";
import { formatDate } from "@/lib/filters";
import { DEFAULT_TIMEZONE } from "@/lib/validation/enums";
import ActivityDetailPage from "./page";

describe("ActivityDetailPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  describe("Isi absensi buttons (task 6.3)", () => {
    const render = async (activityId: number, query: Record<string, string> = {}) =>
      renderToStaticMarkup(
        await ActivityDetailPage({ params: Promise.resolve({ id: String(activityId) }), searchParams: Promise.resolve(query) }),
      );
    // The fixture meets weekly on today's weekday; move it two days ahead so nothing falls today.
    const withoutToday = async (label: string) => {
      const fixture = await buildPageFixture(label);
      const next = addDays(today(DEFAULT_TIMEZONE), 2);
      await db.activity.update({ where: { id: fixture.activityId }, data: { weekdays: [weekdayOf(next)] } });
      return { fixture, next };
    };

    it.each(["ADMIN", "OWNER"] as const)("offers %s the next occurrence, with its date, when none falls today", async (role) => {
      const { fixture, next } = await withoutToday(`kegiatan-detail-next-${role}`);
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, role, fixture.leaf) });

      const html = await render(fixture.activityId);
      expect(html).toContain(`href="/dashboard/kegiatan/${fixture.activityId}/${next}"`);
      expect(html).toContain(`Isi absensi · ${WEEKDAY_LABELS[weekdayOf(next)].slice(0, 3)}, ${formatDate(next)}`);
      expect(html).not.toContain("Isi absensi hari ini");
    });

    it("offers a USER no header button when nothing falls today", async () => {
      const { fixture } = await withoutToday("kegiatan-detail-next-user");
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });

      expect(await render(fixture.activityId)).not.toMatch(/Isi absensi (hari ini|·)/);
    });

    it("keeps today's occurrence on the header button for ADMIN", async () => {
      const fixture = await buildPageFixture("kegiatan-detail-today-admin");
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.leaf) });

      const html = await render(fixture.activityId);
      expect(html).toContain(`href="/dashboard/kegiatan/${fixture.activityId}/${today(DEFAULT_TIMEZONE)}"`);
      expect(html).toContain("Isi absensi hari ini");
    });

    it("labels future Jadwal rows Isi absensi for ADMIN, and only today's row for USER", async () => {
      const fixture = await buildPageFixture("kegiatan-detail-jadwal-rows");
      const rowButtons = async (role: "ADMIN" | "USER") => {
        mockAuthSession(auth, { user: sessionFor(fixture.actorId, role, fixture.leaf) });
        return (await render(fixture.activityId, { tab: "jadwal" })).match(/Isi absensi<svg/g)?.length ?? 0;
      };

      expect(await rowButtons("USER")).toBe(1);
      expect(await rowButtons("ADMIN")).toBeGreaterThan(1);
    });

    it("fills only today's Jadwal row button and outlines future ones", async () => {
      const fixture = await buildPageFixture("kegiatan-detail-jadwal-variants");
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "ADMIN", fixture.leaf) });

      const html = await render(fixture.activityId, { tab: "jadwal" });
      const rowLink = (date: string) =>
        html.match(new RegExp(`<a [^>]*href="/dashboard/kegiatan/${fixture.activityId}/${date}"[^>]*>Isi absensi<svg`))?.[0] ?? "";
      expect(rowLink(today(DEFAULT_TIMEZONE))).toContain("bg-primary");
      expect(rowLink(addDays(today(DEFAULT_TIMEZONE), 7))).not.toContain("bg-primary");
      expect(rowLink(addDays(today(DEFAULT_TIMEZONE), 7))).toContain("border-border bg-background");
    });
  });

  it("renders the editable view for the owning group without crashing", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-owner");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({
        params: Promise.resolve({ id: String(fixture.activityId) }),
        searchParams: Promise.resolve({ tab: "pengaturan" }),
      }),
    );
    expect(html).toContain("Kajian Uji");
    expect(html).toContain("Ubah kegiatan");
    expect(html).toContain("Hapus kegiatan");
  });

  it("renders the read-only (inherited) view for an ancestor group without crashing", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-inherited");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({
        params: Promise.resolve({ id: String(fixture.activityId) }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("Kajian Uji");
    expect(html).toContain("diwarisi dari");
  });

  it("shows the activity's visible tags with a picker, also for a group that only inherits the activity (task 5.3)", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-tags");
    const tag = await db.tag.create({
      data: { groupId: fixture.root.id, key: "fokus-root", value: null, color: "blue", createdById: fixture.actorId },
    });
    await db.activityTag.create({ data: { activityId: fixture.activityId, tagId: tag.id, createdById: fixture.actorId } });
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({ params: Promise.resolve({ id: String(fixture.activityId) }), searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("fokus-root");
    expect(html).toContain("Atur tag");
  });

  it("shows activity tags read-only when the user can neither use nor create any (task 5.3)", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-tags-readonly");
    const tag = await db.tag.create({
      data: { groupId: fixture.leaf.id, key: "binaan-leaf", value: null, color: "blue", createdById: fixture.actorId },
    });
    await db.activityTag.create({ data: { activityId: fixture.activityId, tagId: tag.id, createdById: fixture.actorId } });
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.branch) });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({ params: Promise.resolve({ id: String(fixture.activityId) }), searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("binaan-leaf");
    expect(html).not.toContain("Atur tag");
  });

  it("never renders the settings tab for a caller who cannot edit, even when asked for it", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-inherited-settings");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({
        params: Promise.resolve({ id: String(fixture.activityId) }),
        searchParams: Promise.resolve({ tab: "pengaturan" }),
      }),
    );
    expect(html).not.toContain("Hapus kegiatan");
    expect(html).toContain("Rekap absensi");
  });

  it("shows the conflict warning banner when ?conflict=1", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-conflict");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await ActivityDetailPage({
        params: Promise.resolve({ id: String(fixture.activityId) }),
        searchParams: Promise.resolve({ conflict: "1" }),
      }),
    );
    expect(html).toContain("berkonflik dengan kegiatan lain");
  });

  it("404s for a non-numeric id", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-bad-id");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.leaf);
    mockAuthSession(auth, { user: session });

    await expect(
      ActivityDetailPage({ params: Promise.resolve({ id: "abc" }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
  });

  it("404s for an activity outside the caller's scope", async () => {
    const fixture = await buildPageFixture("kegiatan-detail-out-of-scope");
    const outsider = sessionFor(fixture.actorId, "OWNER", fixture.otherLeaf);
    mockAuthSession(auth, { user: outsider });

    await expect(
      ActivityDetailPage({
        params: Promise.resolve({ id: String(fixture.activityId) }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(
      ActivityDetailPage({ params: Promise.resolve({ id: "1" }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });

  describe("Rincian kehadiran (task 6.2)", () => {
    async function render(label: string, searchParams: Record<string, string>) {
      const fixture = await buildPageFixture(label);
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.leaf) });
      return renderToStaticMarkup(
        await ActivityDetailPage({
          params: Promise.resolve({ id: String(fixture.activityId) }),
          searchParams: Promise.resolve(searchParams),
        }),
      );
    }

    it("offers the picker on the Absensi tab and shows the table once a dimension is chosen", async () => {
      const plain = await render("kegiatan-rincian-none", {});
      expect(plain).toContain("Rincian menurut");
      expect(plain).not.toContain("Berdasarkan data anggota saat ini.");
      const chosen = await render("kegiatan-rincian-sex", { rincian: "sex" });
      expect(chosen).toContain("Berdasarkan data anggota saat ini.");
    });

    it("ignores an unknown tag without an error", async () => {
      const html = await render("kegiatan-rincian-bad", { rincian: "tag:999999" });
      expect(html).not.toContain("Berdasarkan data anggota saat ini.");
    });
  });

  describe("server-paginated tables (tasks 7.2-7.3)", () => {
    async function render(label: string, searchParams: Record<string, string>) {
      const fixture = await buildPageFixture(label);
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.leaf) });
      return renderToStaticMarkup(
        await ActivityDetailPage({
          params: Promise.resolve({ id: String(fixture.activityId) }),
          searchParams: Promise.resolve(searchParams),
        }),
      );
    }

    it("shows both tables with their own sort selects", async () => {
      const html = await render("kegiatan-tables-default", {});
      expect(html).toContain('aria-label="Urutkan kejadian"');
      expect(html).toContain('aria-label="Urutkan peserta"');
    });

    it("ignores unknown sort keys and clamps pages far past the end", async () => {
      const html = await render("kegiatan-tables-hostile", {
        ksort: "phone",
        psort: "__proto__",
        pdir: "sideways",
        kejadian: "999",
        peserta: "-4",
      });
      expect(html).toContain('aria-label="Urutkan kejadian"');
      // The default orders stay active: newest occurrence first, highest % hadir first.
      expect(html).toMatch(/aria-sort="descending"[^>]*><a [^>]*>Tanggal/);
      expect(html).toMatch(/aria-sort="descending"[^>]*><a [^>]*>% Hadir/);
    });
  });
});
