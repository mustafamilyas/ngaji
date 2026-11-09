import { audit } from "@/lib/audit";
import { MEMBER_CODE_BACKFILL_BATCH, MEMBER_CODE_BACKFILL_TIMEOUT_MS } from "@/lib/constants";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { newMemberCodes, type Tx } from "@/lib/member/mutations";
import { memberCodePrefixSchema } from "@/lib/validation/organization";

type OrganizationPrefix = { id: number; name: string; memberCodePrefix: string | null };

export type BackfillResult = { organizationId: number; name: string; prefix: string; prefixSet: boolean; codes: number };

/** `["1=ANR", "2=xyz"]` → organization id → uppercased prefix. Messages are for the operator (CLI). */
export function parseBackfillArgs(args: readonly string[]): Map<number, string> {
  const prefixes = new Map<number, string>();
  for (const arg of args) {
    const match = /^([1-9]\d*)=([^=]+)$/.exec(arg);
    const prefix = match ? memberCodePrefixSchema.safeParse(match[2]) : null;
    if (!match || !prefix?.success) {
      throw new ValidationError(`Invalid argument "${arg}": expected <organizationId>=<PREFIX> (2–4 letters A–Z)`);
    }
    const id = Number(match[1]);
    if (prefixes.has(id)) throw new ValidationError(`Organization ${id} is given more than once`);
    prefixes.set(id, prefix.data);
  }
  return prefixes;
}

/**
 * Prefixes to set, checked against every organization before anything is written: ids must exist,
 * an existing prefix may be repeated but never changed, prefixes stay unique, and no organization
 * may be left without one.
 */
export function planPrefixes(
  organizations: readonly OrganizationPrefix[],
  requested: ReadonlyMap<number, string>,
): Map<number, string> {
  const known = new Set(organizations.map((organization) => organization.id));
  const unknown = [...requested.keys()].filter((id) => !known.has(id));
  if (unknown.length > 0) throw new ValidationError(`Unknown organization id: ${unknown.join(", ")}`);

  const ownerOf = new Map<string, number>();
  for (const { id, memberCodePrefix } of organizations) if (memberCodePrefix) ownerOf.set(memberCodePrefix, id);

  const toSet = new Map<number, string>();
  for (const { id, memberCodePrefix } of organizations) {
    const prefix = requested.get(id);
    if (!prefix) continue;
    if (memberCodePrefix) {
      if (memberCodePrefix !== prefix) {
        throw new ValidationError(`Organization ${id} already has prefix ${memberCodePrefix}; prefixes cannot change`);
      }
      continue;
    }
    const owner = ownerOf.get(prefix);
    if (owner !== undefined) throw new ValidationError(`Prefix ${prefix} is already used by organization ${owner}`);
    ownerOf.set(prefix, id);
    toSet.set(id, prefix);
  }

  const missing = organizations.filter((organization) => !organization.memberCodePrefix && !toSet.has(organization.id));
  if (missing.length > 0) {
    const list = missing.map((organization) => `${organization.id} (${organization.name})`).join(", ");
    throw new ValidationError(`Every organization needs a prefix. Missing: ${list}`);
  }
  return toSet;
}

async function backfillOrganization(
  tx: Tx,
  organization: OrganizationPrefix,
  newPrefix: string | undefined,
): Promise<BackfillResult> {
  const root = await tx.group.findFirst({ where: { organizationId: organization.id, depth: 0 }, select: { id: true } });
  const auditBase = { actorId: null, entity: "Organization", entityId: organization.id, groupId: root?.id };

  if (newPrefix) {
    await tx.organization.update({ where: { id: organization.id }, data: { memberCodePrefix: newPrefix } });
    await audit(tx, {
      ...auditBase,
      action: "organization.update",
      before: { memberCodePrefix: null },
      after: { memberCodePrefix: newPrefix },
    });
  }

  let codes = 0;
  for (;;) {
    // Raw SQL: soft-deleted members (and members of soft-deleted groups) get codes too; `lib/db.ts` hides them.
    const rows = await tx.$queryRaw<{ id: number | bigint }[]>`
      SELECT m.id FROM Member m JOIN "Group" g ON g.id = m.groupId
      WHERE g.organizationId = ${organization.id} AND m.code IS NULL
      LIMIT ${MEMBER_CODE_BACKFILL_BATCH}`;
    if (rows.length === 0) break;
    const batch = await newMemberCodes(tx, organization.id, rows.length);
    for (const [i, row] of rows.entries()) {
      await tx.member.update({ where: { id: Number(row.id) }, data: { code: batch[i] } });
    }
    codes += rows.length;
  }
  if (codes > 0) await audit(tx, { ...auditBase, action: "member.code_backfill", meta: { count: codes } });

  return {
    organizationId: organization.id,
    name: organization.name,
    prefix: (newPrefix ?? organization.memberCodePrefix)!,
    prefixSet: Boolean(newPrefix),
    codes,
  };
}

/**
 * Gives every organization its prefix and every member without a code one (member-code spec, design §4).
 * Validates the whole plan first; then one transaction per organization, so a crash leaves each
 * organization either done or untouched and a re-run finishes the rest. Idempotent.
 */
export async function backfillMemberCodes(requested: ReadonlyMap<number, string>): Promise<BackfillResult[]> {
  const organizations = await db.organization.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true, memberCodePrefix: true },
  });
  const toSet = planPrefixes(organizations, requested);

  const results: BackfillResult[] = [];
  for (const organization of organizations) {
    results.push(
      await db.$transaction((tx) => backfillOrganization(tx, organization, toSet.get(organization.id)), {
        timeout: MEMBER_CODE_BACKFILL_TIMEOUT_MS,
      }),
    );
  }
  return results;
}
