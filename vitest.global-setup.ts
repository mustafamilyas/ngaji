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

  execSync("pnpm prisma db push --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
}
