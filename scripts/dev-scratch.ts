/**
 * `pnpm dev:scratch` — a dev server on a throwaway, freshly seeded database, so browser checks never touch
 * prisma/dev.db (and never need a password change or a hand-built DATABASE_URL).
 *
 *   pnpm dev:scratch                 port 3100, database deleted on exit
 *   pnpm dev:scratch --port 4200
 *   pnpm dev:scratch --keep          keep the database file after Ctrl+C (its path is printed)
 *
 * Stop any `pnpm dev` running in this folder first: two `next dev` servers cannot share `.next`.
 */
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { createServer } from "node:net";
import { parseArgs } from "./dev-scratch/args";
import { formatBanner } from "./dev-scratch/banner";
import { sleep } from "./viewport-audit/cdp";
import { prepareScratchDatabase } from "./viewport-audit/env";

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    console.error("Usage: pnpm dev:scratch [--port <1024-65535>] [--keep]");
    return 2;
  }
  if (!(await isPortFree(options.port))) {
    console.error(`Port ${options.port} is in use. Stop that server or pick another port with --port.`);
    return 1;
  }

  const scratch = prepareScratchDatabase();
  const baseUrl = `http://localhost:${options.port}`;
  console.error(`Starting next dev on port ${options.port}...`);
  // Own process group, so stopping us also stops pnpm's child `next-server` (killing only pnpm leaves it running).
  const server = spawn("pnpm", ["exec", "next", "dev", "-p", String(options.port)], {
    env: scratch.env,
    stdio: "inherit",
    detached: true,
  });

  let stopping = false;
  const stop = (code: number) => {
    if (stopping) return;
    stopping = true;
    if (server.pid && server.exitCode === null) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        // already gone
      }
    }
    if (!options.keep) rmSync(scratch.dir, { recursive: true, force: true });
    process.exit(code);
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, () => stop(0));
  server.on("exit", (code) => stop(code ?? 1));

  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await fetch(`${baseUrl}/login`)).ok) {
        console.error(formatBanner({ baseUrl, dbPath: scratch.dbPath, keep: options.keep }));
        return await new Promise<number>(() => {
          /* run until a signal or the server exits */
        });
      }
    } catch {
      // not listening yet
    }
    await sleep(500);
  }
  console.error("next dev did not become ready in 60s.");
  stop(1);
  return 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
