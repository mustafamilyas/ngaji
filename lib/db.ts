import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Next.js bundles each route/Server Action into its own `.next/server/...`
 * directory, and a relative `file:` datasource URL gets resolved against
 * that bundle's location instead of the project root — silently opening (or
 * creating) an empty, table-less SQLite file per route. Resolving to an
 * absolute path here, matching where `prisma migrate`/`db seed` write
 * (relative to `prisma/`, per `DATABASE_URL="file:./dev.db"`), sidesteps it.
 */
export function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  const FILE_PREFIX = "file:";
  if (!raw.startsWith(FILE_PREFIX)) return raw;

  const relativePath = raw.slice(FILE_PREFIX.length);
  if (path.isAbsolute(relativePath)) return raw;

  return `${FILE_PREFIX}${path.join(process.cwd(), "prisma", relativePath)}`;
}

/**
 * Every Group/Member/Activity read goes through this extension so a missing
 * `deletedAt: null` filter can never leak a soft-deleted row (see DESIGN.md §2).
 */
const adapter = new PrismaBetterSqlite3({ url: resolveDatabaseUrl() });

export const db = new PrismaClient({ adapter }).$extends({
  name: "soft-delete-filter",
  query: {
    group: {
      findMany({ args, query }) {
        return query({ ...args, where: { ...args.where, deletedAt: null } });
      },
      findFirst({ args, query }) {
        return query({ ...args, where: { ...args.where, deletedAt: null } });
      },
      findUnique({ args, query }) {
        return query({ ...args, where: { ...args.where, deletedAt: null } });
      },
      count({ args, query }) {
        return query({ ...args, where: { ...args.where, deletedAt: null } });
      },
    },
    member: {
      findMany({ args, query }) {
        return query({ ...args, where: { ...args.where, deletedAt: null } });
      },
      findFirst({ args, query }) {
        return query({ ...args, where: { ...args.where, deletedAt: null } });
      },
      findUnique({ args, query }) {
        return query({ ...args, where: { ...args.where, deletedAt: null } });
      },
      count({ args, query }) {
        return query({ ...args, where: { ...args.where, deletedAt: null } });
      },
    },
    activity: {
      findMany({ args, query }) {
        return query({ ...args, where: { ...args.where, deletedAt: null } });
      },
      findFirst({ args, query }) {
        return query({ ...args, where: { ...args.where, deletedAt: null } });
      },
      findUnique({ args, query }) {
        return query({ ...args, where: { ...args.where, deletedAt: null } });
      },
      count({ args, query }) {
        return query({ ...args, where: { ...args.where, deletedAt: null } });
      },
    },
  },
});
