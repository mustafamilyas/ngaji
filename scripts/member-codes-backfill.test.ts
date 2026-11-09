import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/lib/generated/prisma/client";

const exec = promisify(execFile);
const CODE = (prefix: string) => new RegExp(`^${prefix}-[0-9A-HJKMNP-TV-Z]{6}$`);

/**
 * Runs the real script against its own temporary database: the backfill refuses to run while any
 * organization lacks a prefix, which the shared test.db (many fixture organizations) always has.
 */
describe("scripts/member-codes-backfill.ts", () => {
  let dir: string;
  let env: NodeJS.ProcessEnv;
  let client: PrismaClient;
  let first: number;
  let second: number;

  async function backfill(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await exec("pnpm", ["exec", "tsx", "scripts/member-codes-backfill.ts", ...args], {
        env,
        timeout: 60_000,
      });
      return { code: 0, stdout, stderr };
    } catch (error) {
      const failed = error as { code?: number; stdout?: string; stderr?: string };
      return { code: failed.code ?? 1, stdout: failed.stdout ?? "", stderr: failed.stderr ?? "" };
    }
  }

  const snapshot = async () => ({
    organizations: await client.organization.findMany({ orderBy: { id: "asc" }, select: { id: true, memberCodePrefix: true } }),
    members: await client.member.findMany({ orderBy: { id: "asc" }, select: { id: true, code: true } }),
    audits: await client.auditLog.count(),
  });

  async function organizationWithMembers(name: string, count: number, actorId: number): Promise<number> {
    const organization = await client.organization.create({ data: { name } });
    const root = await client.group.create({ data: { organizationId: organization.id, depth: 0, name: "Pusat", path: "" } });
    await client.group.update({ where: { id: root.id }, data: { path: `${root.id}/` } });
    await client.member.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        groupId: root.id,
        name: `${name} ${i}`,
        birthPlace: "Bandung",
        birthDate: "1990-01-01",
        sex: "L",
        address: "-",
        maritalStatus: "MENIKAH",
        workStatus: "BEKERJA",
        joinedAt: "2024-01-01",
        createdById: actorId,
        // A soft-deleted member gets a code too (member-code spec).
        deletedAt: i === 0 ? new Date() : null,
      })),
    });
    return organization.id;
  }

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "dahan-backfill-"));
    const url = `file:${join(dir, "backfill.db")}`;
    env = { ...process.env, DATABASE_URL: url };
    execFileSync("pnpm", ["prisma", "migrate", "deploy"], { env, stdio: "ignore" });

    client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
    const actor = await client.user.create({ data: { username: "backfill-actor", passwordHash: "x", name: "Actor" } });
    // 520 crosses one MEMBER_CODE_BACKFILL_BATCH (500).
    first = await organizationWithMembers("Pertama", 520, actor.id);
    second = await organizationWithMembers("Kedua", 20, actor.id);
  }, 120_000);

  afterAll(async () => {
    await client?.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  it("refuses partial coverage and changes nothing", async () => {
    const before = await snapshot();

    const none = await backfill();
    expect(none.code).toBe(1);
    expect(none.stderr).toContain(`${first} (Pertama)`);

    const partial = await backfill(`${first}=ANR`);
    expect(partial.code).toBe(1);
    expect(partial.stderr).toContain(`${second} (Kedua)`);

    expect(await snapshot()).toEqual(before);
  }, 120_000);

  it("rejects malformed arguments with usage and exit code 2", async () => {
    const result = await backfill("ANR");
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Usage:");
  }, 60_000);

  it("sets the prefixes, gives every member a unique code and audits per organization", async () => {
    const result = await backfill(`${first}=anr`, `${second}=XYZ`);
    expect(result.code).toBe(0);

    const { organizations, members } = await snapshot();
    expect(organizations.map((o) => o.memberCodePrefix)).toEqual(["ANR", "XYZ"]);
    expect(members).toHaveLength(540);
    expect(new Set(members.map((m) => m.code)).size).toBe(540);
    const groups = await client.group.findMany({ select: { id: true, organizationId: true } });
    const orgOfGroup = new Map(groups.map((g) => [g.id, g.organizationId]));
    const all = await client.member.findMany({ select: { code: true, groupId: true } });
    for (const member of all) expect(member.code).toMatch(CODE(orgOfGroup.get(member.groupId) === first ? "ANR" : "XYZ"));

    const audits = await client.auditLog.findMany({ orderBy: { id: "asc" } });
    expect(audits.map((a) => [a.action, a.entityId, a.actorId])).toEqual([
      ["organization.update", first, null],
      ["member.code_backfill", first, null],
      ["organization.update", second, null],
      ["member.code_backfill", second, null],
    ]);
    expect(audits[0]).toMatchObject({ before: { memberCodePrefix: null }, after: { memberCodePrefix: "ANR" } });
    expect(audits[1].meta).toEqual({ count: 520 });
    expect(audits[3].meta).toEqual({ count: 20 });
  }, 120_000);

  it("changes nothing on a second run, with or without the same arguments", async () => {
    const before = await snapshot();
    expect((await backfill(`${first}=ANR`, `${second}=XYZ`)).code).toBe(0);
    expect((await backfill()).code).toBe(0);
    expect(await snapshot()).toEqual(before);
  }, 120_000);

  it("refuses to change an existing prefix", async () => {
    const before = await snapshot();
    const result = await backfill(`${first}=QQQ`);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("already has prefix ANR");
    expect(await snapshot()).toEqual(before);
  }, 60_000);
});
