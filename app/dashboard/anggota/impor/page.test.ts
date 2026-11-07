import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("./actions", () => ({ previewMemberImportAction: vi.fn(), confirmMemberImportAction: vi.fn() }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";
import ImportMembersPage from "./page";

describe("ImportMembersPage", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("renders the upload form with the template link and column help", async () => {
    const fixture = await buildPageFixture("anggota-impor");
    mockAuthSession(auth, { user: sessionFor(fixture.actorId, "OWNER", fixture.root) });

    const html = renderToStaticMarkup(await ImportMembersPage());

    expect(html).toContain("Impor anggota dari CSV");
    expect(html).toContain("/dashboard/anggota/impor/template");
    expect(html).toContain("Format kolom");
    expect(html).toContain("File CSV");
  });

  it("redirects to /login when there is no session", async () => {
    mockAuthSession(auth, null);
    await expect(ImportMembersPage()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });
});
