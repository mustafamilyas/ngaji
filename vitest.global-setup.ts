import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const testDbPath = path.join(process.cwd(), "prisma", "test.db");
const databaseUrl = `file:${testDbPath}`;

export default function setup() {
  process.env.DATABASE_URL = databaseUrl;

  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const file = `${testDbPath}${suffix}`;
    if (existsSync(file)) rmSync(file);
  }

  // The generated client is git-ignored and goes stale after a schema change.
  execSync("pnpm prisma generate", { stdio: "inherit" });

  // The test DB was just deleted, so applying the migrations is non-destructive
  // (and tests the real migration history, unlike `db push`).
  execSync("pnpm prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
}
