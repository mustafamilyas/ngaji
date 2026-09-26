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
import NewMemberPage from "./page";

describe("NewMemberPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the new-member form without crashing", async () => {
    const fixture = await buildPageFixture("anggota-baru");
    const session = sessionFor(fixture.actorId, "OWNER", fixture.root);
    mockAuthSession(auth, { user: session });

    const html = renderToStaticMarkup(await NewMemberPage());
    expect(html).toContain("Anggota baru");
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(NewMemberPage()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
