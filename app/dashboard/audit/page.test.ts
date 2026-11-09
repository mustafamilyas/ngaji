import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { AUDIT_ACTIONS } from "@/lib/constants";
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

  describe("tag actions (task 5.8)", () => {
    const TAG_ACTIONS = ["tag.create", "tag.update", "tag.delete", "member.tag", "member.untag", "activity.tag", "activity.untag"];

    it("offers every tag action in the action filter", () => {
      for (const action of TAG_ACTIONS) expect(AUDIT_ACTIONS as readonly string[]).toContain(action);
    });

    it("lists every audit action written by lib/tag, so a new one cannot be left out of the filter", () => {
      const written = new Set<string>();
      for (const file of ["lib/tag/assign.ts", "lib/tag/mutations.ts"]) {
        for (const match of readFileSync(file, "utf8").matchAll(/"((?:tag|member|activity)\.(?:create|update|delete|tag|untag))"/g)) {
          written.add(match[1]);
        }
      }
      expect([...written].sort()).toEqual(TAG_ACTIONS.slice().sort());
      for (const action of written) expect(AUDIT_ACTIONS as readonly string[]).toContain(action);
    });

    it("filters the list by a tag action and shows the tag entries", async () => {
      const fixture = await buildPageFixture("audit-tag-actions");
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
      // The filter's own option list names every action, so rows are told apart by their entity ids.
      const entry = (action: string, entityId: number) =>
        db.auditLog.create({ data: { actorId: fixture.actorId, action, entity: "Member", entityId, groupId: fixture.leaf.id, meta: { tagId: 1, memberIds: [fixture.memberId] } } });
      await entry("member.tag", 880001);
      await entry("member.create", 770001);

      const filtered = renderToStaticMarkup(await AuditPage({ searchParams: Promise.resolve({ action: "member.tag" }) }));
      expect(filtered).toContain("Member #880001");
      expect(filtered).not.toContain("Member #770001");

      const all = renderToStaticMarkup(await AuditPage({ searchParams: Promise.resolve({}) }));
      expect(all).toContain("Member #880001");
      expect(all).toContain("Member #770001");
    });

    it("ignores an unknown action instead of filtering by it", async () => {
      const fixture = await buildPageFixture("audit-tag-unknown");
      mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });
      await db.auditLog.create({ data: { actorId: fixture.actorId, action: "tag.create", entity: "Tag", entityId: 990001, groupId: fixture.leaf.id } });

      const html = renderToStaticMarkup(await AuditPage({ searchParams: Promise.resolve({ action: "tag.bogus" }) }));
      expect(html).toContain("Tag #990001");
    });
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
