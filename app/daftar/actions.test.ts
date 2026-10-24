import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { headers } from "next/headers";
import { submitInterestAction } from "./actions";

const valid = { name: "Aksi Publik", phone: "081234567890", organizationName: "Majelis", consent: true, website: "" };

function mockHeaders(entries: Record<string, string>) {
  vi.mocked(headers).mockResolvedValue(new Headers(entries) as Awaited<ReturnType<typeof headers>>);
}

describe("submitInterestAction", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("works without a session, records the proxy-set IP and user agent, and returns the DAHAN_WHATSAPP link", async () => {
    vi.stubEnv("DAHAN_WHATSAPP", "0812-3456-7890");
    mockHeaders({ "x-forwarded-for": "198.51.100.7, 198.51.100.9", "user-agent": "ua-test" });

    const result = await submitInterestAction(valid);

    expect(result).toMatchObject({ ok: true, data: { whatsappUrl: expect.stringContaining("https://wa.me/6281234567890") } });
    const [lead] = await db.interestLead.findMany({ where: { name: "Aksi Publik" } });
    expect(lead).toMatchObject({ ip: "198.51.100.9", userAgent: "ua-test" });
  });

  it("returns a generic error result for tampered input, without a stack or field detail", async () => {
    mockHeaders({ "x-forwarded-for": "198.51.100.20" });

    const result = await submitInterestAction({ ...valid, organizationName: "" });

    expect(result).toEqual({ ok: false, error: "Data tidak valid" });
  });

  it("stores the lead and returns no link when DAHAN_WHATSAPP is unset", async () => {
    vi.stubEnv("DAHAN_WHATSAPP", "");
    mockHeaders({ "x-forwarded-for": "198.51.100.21" });

    const result = await submitInterestAction({ ...valid, name: "Tanpa Env" });

    expect(result).toEqual({ ok: true, data: { whatsappUrl: null } });
    expect(await db.interestLead.count({ where: { name: "Tanpa Env" } })).toBe(1);
  });
});
