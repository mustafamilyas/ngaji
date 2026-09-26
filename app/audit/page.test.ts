import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import AuditPage from "./page";

describe("AuditPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders audit entries without crashing for an OWNER", async () => {
    const fixture = await buildPageFixture("audit-list");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    await db.auditLog.create({
      data: {
        actorId: fixture.actorId,
        action: "member.create",
        entity: "Member",
        entityId: fixture.memberId,
        groupId: fixture.leaf.id,
        after: { name: "Anggota Uji" },
      },
    });

    const html = renderToStaticMarkup(await AuditPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("member.create");
  });

  it("renders with filters applied without crashing", async () => {
    const fixture = await buildPageFixture("audit-list-filters");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(
      await AuditPage({
        searchParams: Promise.resolve({ action: "member.create", aktor: String(fixture.actorId), page: "1" }),
      }),
    );
    expect(html).toContain("Audit Log");
  });

  it("404s for a non-OWNER (the page must not reveal it exists)", async () => {
    const fixture = await buildPageFixture("audit-forbidden");
    const session = sessionFor(fixture.actorId, "ADMIN", fixture.root);
    mockAuthSession(auth, { user: session });

    await expect(AuditPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
    });
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(AuditPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
