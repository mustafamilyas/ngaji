import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import UsersPage from "./page";

describe("UsersPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the user list (including self and another user) without crashing", async () => {
    const fixture = await buildPageFixture("pengguna-list");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    await db.userGroupRole.create({
      data: { userId: fixture.actorId, groupId: fixture.root.id, role: "OWNER" },
    });
    const other = await db.user.create({
      data: { username: "pengguna-list-other", passwordHash: "x", name: "Other User" },
    });
    await db.userGroupRole.create({ data: { userId: other.id, groupId: fixture.leaf.id, role: "ADMIN" } });

    const html = renderToStaticMarkup(await UsersPage());
    expect(html).toContain("Other User");
  });

  it("renders the empty state without crashing", async () => {
    const fixture = await buildPageFixture("pengguna-empty");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(await UsersPage());
    expect(html).toContain("Belum ada pengguna.");
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(UsersPage()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
