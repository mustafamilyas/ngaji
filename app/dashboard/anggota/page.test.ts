import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
// The page reads the column-preference cookie; there is no request scope in tests.
const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieValue.current ? { value: cookieValue.current } : undefined) }),
}));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import MembersPage from "./page";

describe("MembersPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the member list without crashing", async () => {
    const fixture = await buildPageFixture("anggota-list");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(await MembersPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Anggota Uji");
  });

  describe("tag column (task 5.4)", () => {
    it("shows each member's visible tags with a compact picker for a user who can use tags", async () => {
      const fixture = await buildPageFixture("anggota-list-tag-column");
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });
      const tag = await db.tag.create({ data: { groupId: fixture.root.id, key: "fokus-kolom", color: "blue", createdById: fixture.actorId } });
      await db.memberTag.create({ data: { memberId: fixture.memberId, tagId: tag.id, createdById: fixture.actorId } });

      const html = renderToStaticMarkup(await MembersPage({ searchParams: Promise.resolve({}) }));
      expect(html).toContain("fokus-kolom");
      expect(html).toContain("Atur tag Anggota Uji");
    });

    it("shows chips without a picker when the user can neither use nor create tags", async () => {
      const fixture = await buildPageFixture("anggota-list-tag-column-ro");
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.branch) });
      const tag = await db.tag.create({ data: { groupId: fixture.leaf.id, key: "binaan-kolom", color: "blue", createdById: fixture.actorId } });
      await db.memberTag.create({ data: { memberId: fixture.memberId, tagId: tag.id, createdById: fixture.actorId } });

      const html = renderToStaticMarkup(await MembersPage({ searchParams: Promise.resolve({}) }));
      expect(html).toContain("binaan-kolom");
      expect(html).not.toContain("Atur tag");
    });

    it("renders no tag data when the column is hidden", async () => {
      const fixture = await buildPageFixture("anggota-list-tag-column-hidden");
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
      const tag = await db.tag.create({ data: { groupId: fixture.root.id, key: "tersembunyi", color: "blue", createdById: fixture.actorId } });
      await db.memberTag.create({ data: { memberId: fixture.memberId, tagId: tag.id, createdById: fixture.actorId } });
      cookieValue.current = "grup,status";

      const html = renderToStaticMarkup(await MembersPage({ searchParams: Promise.resolve({}) }));
      expect(html).toContain("Anggota Uji");
      expect(html).not.toContain("tersembunyi");
      cookieValue.current = undefined;
    });
  });

  it("renders with search/status/page filters applied without crashing", async () => {
    const fixture = await buildPageFixture("anggota-list-filters");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await MembersPage({
        searchParams: Promise.resolve({ q: "Uji", status: "AKTIF", grup: String(fixture.leaf.id), page: "1" }),
      }),
    );
    expect(html).toContain("Anggota Uji");
  });

  it("filters by the tag param, dropping ids the user cannot see", async () => {
    const fixture = await buildPageFixture("anggota-list-tag");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });
    const tag = await db.tag.create({ data: { groupId: fixture.root.id, key: "fokus", color: "blue", createdById: fixture.actorId } });
    const other = await buildPageFixture("anggota-list-tag-other");
    const foreign = await db.tag.create({ data: { groupId: other.root.id, key: "asing", color: "red", createdById: other.actorId } });

    const without = renderToStaticMarkup(
      await MembersPage({ searchParams: Promise.resolve({ tag: String(tag.id) }) }),
    );
    expect(without).toContain("Tidak ada anggota yang cocok");

    await db.memberTag.create({ data: { memberId: fixture.memberId, tagId: tag.id, createdById: fixture.actorId } });
    const withTag = renderToStaticMarkup(
      await MembersPage({ searchParams: Promise.resolve({ tag: `${tag.id},${foreign.id}` }) }),
    );
    expect(withTag).toContain("Anggota Uji");
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(MembersPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("renders only the optional columns chosen in the cookie", async () => {
    const fixture = await buildPageFixture("anggota-kolom");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    cookieValue.current = "alamat";
    try {
      const html = renderToStaticMarkup(await MembersPage({ searchParams: Promise.resolve({}) }));
      expect(html).toContain("Alamat");
      expect(html).not.toContain("Jenis kelamin");
      expect(html).not.toContain("wa.me");
    } finally {
      cookieValue.current = undefined;
    }
  });

  it("sorts by a visible column from the URL, and ignores a sort on a hidden column", async () => {
    const fixture = await buildPageFixture("anggota-sort");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });
    await db.member.create({
      data: {
        groupId: fixture.leaf.id,
        name: "Zaid Uji",
        birthPlace: "Bandung",
        birthDate: "1990-01-01",
        sex: "L",
        address: "Jl. Uji No. 2",
        phone: "081200000001",
        maritalStatus: "MENIKAH",
        workStatus: "BEKERJA",
        status: "AKTIF",
        joinedAt: "2025-01-01",
        createdById: fixture.actorId,
      },
    });
    const order = (html: string) => html.indexOf("Zaid Uji") < html.indexOf("Anggota Uji");

    const byName = renderToStaticMarkup(await MembersPage({ searchParams: Promise.resolve({ q: "Uji" }) }));
    expect(order(byName)).toBe(false);

    const byNameDesc = renderToStaticMarkup(
      await MembersPage({ searchParams: Promise.resolve({ q: "Uji", sort: "nama", dir: "desc" }) }),
    );
    expect(order(byNameDesc)).toBe(true);

    // Birth date is a default column: the older member (Zaid, 1990) comes first ascending.
    const byBirth = renderToStaticMarkup(
      await MembersPage({ searchParams: Promise.resolve({ q: "Uji", sort: "tanggalLahir", dir: "asc" }) }),
    );
    expect(order(byBirth)).toBe(true);

    cookieValue.current = "alamat";
    try {
      const hidden = renderToStaticMarkup(
        await MembersPage({ searchParams: Promise.resolve({ q: "Uji", sort: "tanggalLahir", dir: "asc" }) }),
      );
      expect(order(hidden)).toBe(false);
    } finally {
      cookieValue.current = undefined;
    }
  });
});
