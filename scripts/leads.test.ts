import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";

const exec = promisify(execFile);

/** Runs the real script (`pnpm leads`) as a child process against the test database. */
async function leads(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await exec("pnpm", ["exec", "tsx", "scripts/leads.ts", ...args], {
      cwd: process.cwd(),
      env: process.env,
      timeout: 60_000,
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failed.code ?? 1, stdout: failed.stdout ?? "", stderr: failed.stderr ?? "" };
  }
}

const counts = async () => ({ leads: await db.interestLead.count(), audits: await db.auditLog.count() });

describe("scripts/leads.ts", () => {
  beforeAll(async () => {
    await db.interestLead.create({
      data: {
        name: "Leads Skrip Newest",
        phone: "6281200000099",
        organizationName: "Majelis Uji Skrip",
        memberCount: 12,
        message: "Baris\nkedua, dengan koma",
        consentAt: new Date("2030-01-01T00:00:00Z"),
        createdAt: new Date("2030-01-01T10:20:00Z"),
      },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("prints the table with the UTC time header and the lead, one line per lead", async () => {
    const { code, stdout } = await leads();

    expect(code).toBe(0);
    expect(stdout.split("\n")[0]).toMatch(/^waktu \(UTC\)\s+nama\s+whatsapp\s+organisasi\s+anggota\s+pesan$/);
    const row = stdout.split("\n").find((line) => line.includes("Leads Skrip Newest")) ?? "";
    expect(row).toMatch(/^2030-01-01 10:20\s+Leads Skrip Newest\s+6281200000099\s+Majelis Uji Skrip\s+12\s+Baris kedua, dengan koma$/);
  });

  it("lists the newest lead first", async () => {
    const { stdout } = await leads();
    // 2030 is later than every other test lead, so it is the first data row.
    expect(stdout.split("\n")[1]).toContain("Leads Skrip Newest");
  });

  it("--csv writes a header row and quotes commas and newlines", async () => {
    const { code, stdout } = await leads("--csv");

    expect(code).toBe(0);
    expect(stdout.split("\n")[0]).toMatch(/^createdAt,name,phone,organizationName,/);
    expect(stdout).toContain('"Baris\nkedua, dengan koma"');
    expect(stdout).toContain("Leads Skrip Newest");
  });

  it("refuses unknown arguments with usage on stderr and exit code 2, printing no data", async () => {
    const { code, stdout, stderr } = await leads("--json");

    expect(code).toBe(2);
    expect(stderr).toContain("Usage: pnpm leads [--csv]");
    expect(stdout).not.toContain("Leads Skrip Newest");
  });

  it("is read-only: it adds neither leads nor audit entries", async () => {
    const before = await counts();

    await leads();
    await leads("--csv");

    expect(await counts()).toEqual(before);
  });
});
