import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { buildPageFixture, mockAuthSession, sessionFor } from "@/lib/test/fixtures";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { auth } from "@/auth";
import { GET } from "./route";

describe("GET /dashboard/anggota/impor/template", () => {
  let user: ReturnType<typeof sessionFor>;

  beforeAll(async () => {
    const fx = await buildPageFixture("import-template");
    user = sessionFor(fx.actorId, "USER", fx.leaf);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("sends the template as a CSV download to a signed-in user", async () => {
    mockAuthSession(auth, { user });
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="template-anggota.csv"');
    const body = await response.text();
    expect(body).toContain("nama,tempat_lahir,tanggal_lahir");
  });

  it("redirects to login without a session and sends no file", async () => {
    mockAuthSession(auth, null);
    await expect(GET()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("answers 403 while a password change is pending", async () => {
    mockAuthSession(auth, { user: { ...user, mustChangePassword: true } });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("nama");
  });
});
