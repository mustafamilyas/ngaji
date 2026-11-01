import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import type { Role } from "./args";
import { freePort, sleep } from "./cdp";
import type { SeedIds } from "./pages";

/** Seeded accounts from prisma/seed.ts (test data only). */
export const CREDENTIALS: Record<Role, { username: string; password: string }> = {
  owner: { username: "admin", password: "admin" },
  admin: { username: "admin_desa", password: "desa123" },
  user: { username: "user_kelompok", password: "user123" },
};

export type ScratchEnv = {
  dir: string;
  databaseUrl: string;
  baseUrl: string;
  ids: SeedIds;
  stop: (options: { keep: boolean }) => void;
};

const run = (args: string[], env: NodeJS.ProcessEnv) =>
  execFileSync("pnpm", args, { env, stdio: ["ignore", "ignore", "inherit"] });

function readSeedIds(dbPath: string): SeedIds {
  const db = new Database(dbPath, { readonly: true });
  const one = (sql: string, ...params: unknown[]) => {
    const row = db.prepare(sql).get(...params) as Record<string, number | string> | undefined;
    return row ? Object.values(row)[0] : null;
  };
  try {
    const attendance = db
      .prepare(
        `SELECT a.id AS activityId, o.date AS date FROM Attendance t
         JOIN ActivityOccurrence o ON o.id = t.occurrenceId
         JOIN Activity a ON a.id = o.activityId
         WHERE a.deletedAt IS NULL ORDER BY o.id LIMIT 1`,
      )
      .get() as { activityId: number; date: string } | undefined;
    return {
      memberId: one("SELECT id FROM Member WHERE deletedAt IS NULL ORDER BY id LIMIT 1") as number | null,
      branchGroupId: one('SELECT id FROM "Group" WHERE depth = 2 AND deletedAt IS NULL ORDER BY id LIMIT 1') as number | null,
      leafGroupId: one('SELECT id FROM "Group" WHERE depth = 3 AND deletedAt IS NULL ORDER BY id LIMIT 1') as number | null,
      activityId: attendance?.activityId ?? null,
      attendanceDate: attendance?.date ?? null,
      surveyId: one("SELECT id FROM Survey WHERE deletedAt IS NULL ORDER BY id LIMIT 1") as number | null,
      viewId: one("SELECT id FROM MemberView WHERE deletedAt IS NULL ORDER BY id LIMIT 1") as number | null,
      keyTagId: one("SELECT id FROM Tag WHERE value IS NOT NULL AND deletedAt IS NULL ORDER BY id LIMIT 1") as number | null,
    };
  } finally {
    db.close();
  }
}

export type ScratchDatabase = {
  dir: string;
  dbPath: string;
  databaseUrl: string;
  /** Environment for child processes that must use this database. */
  env: NodeJS.ProcessEnv;
};

/**
 * Creates a throwaway database (migrate + seed) in a temp folder and clears the forced password change
 * on the seeded accounts. Shared by the viewport audit and `pnpm dev:scratch`; never touches prisma/dev.db.
 */
export function prepareScratchDatabase(prefix = "dahan-scratch-"): ScratchDatabase {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const dbPath = join(dir, "scratch.db");
  const databaseUrl = `file:${dbPath}`;
  const env = { ...process.env, DATABASE_URL: databaseUrl, AUTH_SECRET: "viewport-audit-secret", AUTH_TRUST_HOST: "true" };

  console.error("Preparing scratch database (migrate + seed)...");
  run(["prisma", "migrate", "deploy"], env);
  run(["prisma", "db", "seed"], env);

  const writable = new Database(dbPath);
  writable.prepare("UPDATE User SET mustChangePassword = 0").run();
  writable.close();
  return { dir, dbPath, databaseUrl, env };
}

/**
 * Prepares a scratch database and starts `next dev` on a free port against it. Never touches prisma/dev.db.
 */
export async function startScratchEnv(): Promise<ScratchEnv> {
  const { dir, dbPath, databaseUrl, env } = prepareScratchDatabase("dahan-audit-");
  const ids = readSeedIds(dbPath);

  const port = await freePort();
  console.error(`Starting next dev on port ${port}...`);
  const server: ChildProcess = spawn("pnpm", ["exec", "next", "dev", "-p", String(port)], { env, stdio: "ignore" });
  const baseUrl = `http://localhost:${port}`;

  let ready = false;
  for (let attempt = 0; attempt < 120 && !ready; attempt++) {
    if (server.exitCode !== null) {
      throw new Error("next dev exited early. If another `pnpm dev` is running in this folder, stop it and retry.");
    }
    try {
      ready = (await fetch(`${baseUrl}/login`)).ok;
    } catch {
      // not listening yet
    }
    if (!ready) await sleep(500);
  }
  if (!ready) {
    server.kill();
    throw new Error("next dev did not become ready in 60s.");
  }

  return {
    dir,
    databaseUrl,
    baseUrl,
    ids,
    stop: ({ keep }) => {
      if (keep) {
        console.error(`Left running: ${baseUrl} (pid ${server.pid}), database ${dbPath}`);
        server.unref();
        return;
      }
      server.kill();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
