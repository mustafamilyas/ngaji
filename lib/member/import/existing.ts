import type { SessionUser } from "@/lib/auth/session-user";
import { db } from "@/lib/db";
import { duplicateKey } from "./duplicates";

/**
 * Duplicate keys of non-deleted members in the user's scope born on any of `birthDates`.
 * Scoped and narrowed by date in SQL, so a match can never reveal a member the user cannot see
 * and the result stays small; only name and birth date leave the database.
 */
export async function existingDuplicateKeys(
  session: SessionUser,
  birthDates: readonly string[],
): Promise<Set<string>> {
  const dates = [...new Set(birthDates)];
  if (dates.length === 0) return new Set();

  const members = await db.member.findMany({
    where: {
      deletedAt: null,
      birthDate: { in: dates },
      group: { path: { startsWith: session.groupPath } },
    },
    select: { name: true, birthDate: true },
  });
  return new Set(members.map((member) => duplicateKey(member.name, member.birthDate)));
}
