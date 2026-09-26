import path from "node:path";

/**
 * Next.js bundles each route/Server Action into its own `.next/server/...`
 * directory, and a relative `file:` datasource URL gets resolved against
 * that bundle's location instead of the project root — silently opening (or
 * creating) an empty, table-less SQLite file per route. The Prisma CLI has
 * the mirror-image problem: `prisma.config.ts` resolves the same relative
 * URL against the repo root (where the config file lives), not `prisma/`.
 * Resolving to an absolute path here, relative to `prisma/` (matching where
 * `prisma migrate`/`db seed` are meant to write, per
 * `DATABASE_URL="file:./dev.db"`), sidesteps both — as long as every caller
 * (`lib/db.ts`, `prisma.config.ts`) goes through this one function.
 */
export function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  const FILE_PREFIX = "file:";
  if (!raw.startsWith(FILE_PREFIX)) return raw;

  const relativePath = raw.slice(FILE_PREFIX.length);
  if (path.isAbsolute(relativePath)) return raw;

  return `${FILE_PREFIX}${path.join(process.cwd(), "prisma", relativePath)}`;
}
