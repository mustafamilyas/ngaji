import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { formatLeadsTable, listLeads, parseLeadsArgs } from "./leads";

const row = {
  createdAt: new Date("2026-10-24T16:30:00Z"),
  name: "Budi",
  phone: "6281234567890",
  organizationName: "Majelis An-Nur",
  memberCount: 40,
  message: "Halo",
};

describe("parseLeadsArgs", () => {
  it("defaults to the table and accepts --csv", () => {
    expect(parseLeadsArgs([])).toEqual({ csv: false });
    expect(parseLeadsArgs(["--csv"])).toEqual({ csv: true });
  });

  it.each([["--json"], ["csv"], ["--csv", "extra"]])("rejects %j", (...args) => {
    expect(parseLeadsArgs(args)).toBeNull();
  });
});

describe("formatLeadsTable", () => {
  it("prints a header and one aligned row per lead with the UTC submission time, keeping the given order", () => {
    const lines = formatLeadsTable([
      row,
      { ...row, createdAt: new Date("2026-10-23T01:02:00Z"), name: "Siti", phone: "6289876543210", memberCount: null, message: null },
    ]).split("\n");

    expect(lines[0]).toMatch(/^waktu \(UTC\)\s+nama\s+whatsapp\s+organisasi\s+anggota\s+pesan$/);
    expect(lines[1]).toMatch(/^2026-10-24 16:30\s+Budi\s+6281234567890\s+Majelis An-Nur\s+40\s+Halo$/);
    expect(lines[2]).toMatch(/^2026-10-23 01:02\s+Siti\s+6289876543210\s+Majelis An-Nur\s+-\s+-$/);
    // Columns line up across rows.
    expect(lines[1].indexOf("Budi")).toBe(lines[2].indexOf("Siti"));
    expect(lines[1].indexOf("Majelis")).toBe(lines[2].indexOf("Majelis"));
  });

  it("keeps each lead on one line by collapsing newlines and runs of spaces in free text", () => {
    const lines = formatLeadsTable([{ ...row, message: "baris satu\nbaris   dua\r\nbaris tiga" }]).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("baris satu baris dua baris tiga");
  });

  it("says so when there are no leads", () => {
    expect(formatLeadsTable([])).toBe("Belum ada lead.");
  });
});

describe("listLeads", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("returns leads newest first, ties broken by id, and writes nothing", async () => {
    const same = new Date("2030-01-01T00:00:00Z");
    const mk = (name: string, createdAt: Date) =>
      db.interestLead.create({
        data: { name, phone: "6281200000001", organizationName: "Urutan", consentAt: same, createdAt },
      });
    await mk("Urutan lama", new Date("2029-12-31T00:00:00Z"));
    await mk("Urutan kembar A", same);
    await mk("Urutan kembar B", same);
    const before = await db.interestLead.count();
    const auditBefore = await db.auditLog.count();

    const leads = await listLeads();

    const names = leads.filter((l) => l.organizationName === "Urutan").map((l) => l.name);
    expect(names).toEqual(["Urutan kembar B", "Urutan kembar A", "Urutan lama"]);
    expect(await db.interestLead.count()).toBe(before);
    expect(await db.auditLog.count()).toBe(auditBefore);
  });
});
