import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import NewMemberViewPage from "./page";

describe("NewMemberViewPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("shows the default draft: active members, scoped to the viewer", async () => {
    const fixture = await buildPageFixture("tampilan-baru");
    await db.member.create({
      data: {
        groupId: fixture.leaf.id,
        name: "Sudah Keluar",
        birthPlace: "Jakarta",
        birthDate: "2000-01-01",
        sex: "L",
        address: "-",
        phone: "081200000009",
        maritalStatus: "BELUM_MENIKAH",
        workStatus: "BEKERJA",
        status: "KELUAR",
        joinedAt: "2024-01-01",
        exitedAt: "2025-01-01",
        createdById: fixture.actorId,
      },
    });
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.otherLeaf) });
    const otherScope = renderToStaticMarkup(await NewMemberViewPage({ searchParams: Promise.resolve({}) }));
    expect(otherScope).not.toContain("Anggota Uji");

    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "USER", fixture.leaf) });
    const html = renderToStaticMarkup(await NewMemberViewPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Tampilan baru");
    expect(html).toContain("Anggota Uji");
    expect(html).not.toContain("Sudah Keluar");
  });

  it("redirects to /login without a session", async () => {
    mockAuthSession(auth, null);
    await expect(NewMemberViewPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
