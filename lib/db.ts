import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { resolveDatabaseUrl } from "./database-url";
import { PrismaClient } from "./generated/prisma/client";

export { resolveDatabaseUrl };

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
