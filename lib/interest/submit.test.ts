import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listAuditLog } from "@/lib/audit-log/queries";
import { INTEREST_RATE_LIMIT_MAX_PER_IP, INTEREST_RATE_LIMIT_WINDOW_MINUTES } from "@/lib/constants";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { buildOrgFixture, type OrgFixture } from "@/lib/test/fixtures";
import { submitInterest } from "./submit";

const valid = {
  name: "Budi",
  phone: "0812-3456-7890",
  organizationName: "Majelis An-Nur",
  memberCount: "40",
  message: "Mohon info",
  consent: true,
  website: "",
};

let ipCounter = 0;
/** Each test gets its own IP so the per-IP limit never leaks between tests. */
const freshContext = () => ({ ip: `203.0.113.${++ipCounter}`, userAgent: "vitest" });

const leadsNamed = (name: string) => db.interestLead.findMany({ where: { name } });
const leadAudits = (ip: string) => db.auditLog.findMany({ where: { action: "lead.create", ip } });

describe("submitInterest", () => {
  let orgA: OrgFixture;
  let orgB: OrgFixture;

  beforeAll(async () => {
    orgA = await buildOrgFixture("interest-a");
    orgB = await buildOrgFixture("interest-b");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("stores the lead with consent time, ip and user agent plus an org-less lead.create audit, and returns the WhatsApp URL", async () => {
    const context = freshContext();
    const before = Date.now();

    const result = await submitInterest({ ...valid, name: "Budi Sukses" }, context, "0812-3456-7890");

    const [lead] = await leadsNamed("Budi Sukses");
    expect(lead).toMatchObject({
      phone: "6281234567890",
      organizationName: "Majelis An-Nur",
      memberCount: 40,
      message: "Mohon info",
      ip: context.ip,
      userAgent: "vitest",
    });
    expect(lead.consentAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    const [entry] = await leadAudits(context.ip);
    expect(entry).toMatchObject({
      actorId: null,
      groupId: null,
      entity: "InterestLead",
      entityId: lead.id,
      meta: { leadId: lead.id },
      userAgent: "vitest",
    });
    // PII stays in the lead row only.
    expect(JSON.stringify(entry)).not.toContain("Budi Sukses");
    expect(JSON.stringify(entry)).not.toContain("6281234567890");

    expect(result.whatsappUrl).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    const text = new URL(result.whatsappUrl!).searchParams.get("text");
    expect(text).toContain("Budi Sukses");
    expect(text).toContain("Majelis An-Nur");
  });

  it("still stores the lead and returns no link when DAHAN_WHATSAPP is missing or invalid", async () => {
    for (const [i, destination] of [undefined, "", "abc"].entries()) {
      const name = `Tanpa Nomor ${i}`;
      const result = await submitInterest({ ...valid, name }, freshContext(), destination);
      expect(result).toEqual({ whatsappUrl: null });
      expect(await leadsNamed(name)).toHaveLength(1);
    }
  });

  it("accepts optional fields left empty", async () => {
    const result = await submitInterest(
      { name: "Minimal", phone: "081234567890", organizationName: "Majelis", consent: true },
      freshContext(),
      undefined,
    );
    expect(result).toEqual({ whatsappUrl: null });
    expect(await leadsNamed("Minimal")).toMatchObject([{ memberCount: null, message: null }]);
  });

  it.each([
    ["consent missing", { consent: false }],
    ["consent absent", { consent: undefined }],
    ["invalid phone", { phone: "abc" }],
    ["empty organization name", { organizationName: "   " }],
    ["empty name", { name: "" }],
    ["member count zero", { memberCount: "0" }],
    ["member count not a number", { memberCount: "banyak" }],
    ["oversized message", { message: "x".repeat(5000) }],
  ])("rejects tampered input with a generic error and stores nothing (%s)", async (_label, patch) => {
    const context = freshContext();
    const name = `Tampered ${ipCounter}`;

    await expect(submitInterest({ ...valid, name, ...patch }, context, "0812-3456-7890")).rejects.toThrow(
      ValidationError,
    );

    expect(await leadsNamed(name)).toHaveLength(0);
    expect(await leadAudits(context.ip)).toHaveLength(0);
  });

  it("rejects input that is not an object", async () => {
    await expect(submitInterest(null, freshContext(), undefined)).rejects.toThrow(ValidationError);
    await expect(submitInterest("x", freshContext(), undefined)).rejects.toThrow(ValidationError);
  });

  it("drops a honeypot submission silently: success-shaped answer, no lead, no audit", async () => {
    const context = freshContext();

    const result = await submitInterest({ ...valid, name: "Bot", website: "http://spam.example" }, context, "0812-3456-7890");

    expect(result.whatsappUrl).toMatch(/^https:\/\/wa\.me\//);
    expect(await leadsNamed("Bot")).toHaveLength(0);
    expect(await leadAudits(context.ip)).toHaveLength(0);
  });

  it("answers a honeypot submission with invalid fields as success too, without storing anything", async () => {
    const context = freshContext();

    const result = await submitInterest({ name: "", website: "x" }, context, "0812-3456-7890");

    expect(result).toEqual({ whatsappUrl: null });
    expect(await leadAudits(context.ip)).toHaveLength(0);
  });

  it("refuses the submission after the per-IP limit with a generic message and stores nothing", async () => {
    const context = freshContext();
    for (let i = 0; i < INTEREST_RATE_LIMIT_MAX_PER_IP; i++) {
      await submitInterest({ ...valid, name: `Limit ${context.ip} ${i}` }, context, undefined);
    }

    await expect(submitInterest({ ...valid, name: `Limit ${context.ip} over` }, context, undefined)).rejects.toThrow(
      /coba lagi nanti/i,
    );

    expect(await leadsNamed(`Limit ${context.ip} over`)).toHaveLength(0);
    expect(await leadAudits(context.ip)).toHaveLength(INTEREST_RATE_LIMIT_MAX_PER_IP);
  });

  it("does not let a parallel burst from one IP exceed the limit", async () => {
    const context = freshContext();

    const results = await Promise.allSettled(
      Array.from({ length: INTEREST_RATE_LIMIT_MAX_PER_IP + 4 }, (_, i) =>
        submitInterest({ ...valid, name: `Burst ${context.ip} ${i}` }, context, undefined),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(INTEREST_RATE_LIMIT_MAX_PER_IP);
    expect(await leadAudits(context.ip)).toHaveLength(INTEREST_RATE_LIMIT_MAX_PER_IP);
  });

  it("does not count other IPs or submissions older than the window", async () => {
    const context = freshContext();
    const outside = new Date(Date.now() - (INTEREST_RATE_LIMIT_WINDOW_MINUTES + 1) * 60_000);
    await db.auditLog.createMany({
      data: Array.from({ length: INTEREST_RATE_LIMIT_MAX_PER_IP }, () => ({
        action: "lead.create",
        ip: context.ip,
        createdAt: outside,
      })),
    });
    const other = freshContext();
    for (let i = 0; i < INTEREST_RATE_LIMIT_MAX_PER_IP; i++) {
      await submitInterest({ ...valid, name: `Other ${other.ip} ${i}` }, other, undefined);
    }

    await expect(submitInterest({ ...valid, name: `Window ${context.ip}` }, context, undefined)).resolves.toBeDefined();
  });

  it("stores a lead from an unknown IP and shares one limit across all unknown-IP requests", async () => {
    const unknown = { ip: null, userAgent: null };
    await db.auditLog.deleteMany({ where: { action: "lead.create", ip: null } });

    await submitInterest({ ...valid, name: "No Ip 0" }, unknown, undefined);
    expect(await leadsNamed("No Ip 0")).toMatchObject([{ ip: null, userAgent: null }]);

    for (let i = 1; i < INTEREST_RATE_LIMIT_MAX_PER_IP; i++) {
      await submitInterest({ ...valid, name: `No Ip ${i}` }, unknown, undefined);
    }
    await expect(submitInterest({ ...valid, name: "No Ip over" }, unknown, undefined)).rejects.toThrow(ValidationError);
    expect(await leadsNamed("No Ip over")).toHaveLength(0);

    // A request with a known IP is not affected by the shared bucket.
    await expect(submitInterest({ ...valid, name: "Known Ip" }, freshContext(), undefined)).resolves.toBeDefined();
    await db.auditLog.deleteMany({ where: { action: "lead.create", ip: null } });
  });

  it("never shows lead.create in any organization's audit viewer", async () => {
    await submitInterest({ ...valid, name: "Hidden Lead" }, freshContext(), undefined);

    for (const org of [orgA, orgB]) {
      const { entries } = await listAuditLog(org.owner, { action: "lead.create" });
      expect(entries).toHaveLength(0);
      const all = await listAuditLog(org.owner);
      expect(all.entries.map((e) => e.action)).not.toContain("lead.create");
    }
  });
});
