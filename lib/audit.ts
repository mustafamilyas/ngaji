import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * A structural (duck-typed) stand-in for the transaction client, instead of
 * `Prisma.TransactionClient`: `lib/db.ts`'s soft-delete extension changes
 * the client's extension-args generic, which isn't assignable to the base
 * (unextended) transaction client type. This only needs what `audit` uses.
 */
export type AuditTransactionClient = {
  auditLog: {
    create(args: { data: Prisma.AuditLogUncheckedCreateInput }): Promise<unknown>;
  };
};

export type AuditInput = {
  actorId: number | null;
  action: string;
  entity?: string;
  entityId?: number;
  groupId?: number;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Strips `passwordHash` and any field starting with "password" from an
 * object graph before it is written to `AuditLog` (DESIGN.md §4.4). Dates
 * are passed through untouched — they have no own enumerable keys, so
 * recursing into them like a plain object would silently erase the value.
 */
function redact(value: unknown): unknown {
  if (value === null || typeof value !== "object" || value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith("password")) continue;
    result[key] = redact(val);
  }
  return result;
}

/**
 * Writes one `AuditLog` row. Must be called with the same transaction
 * client as the mutation it records, so a failed audit write rolls the
 * mutation back too (DESIGN.md §4.4/§4.5).
 */
export async function audit(tx: AuditTransactionClient, input: AuditInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity ?? null,
      entityId: input.entityId ?? null,
      groupId: input.groupId ?? null,
      before: input.before !== undefined ? (redact(input.before) as Prisma.InputJsonValue) : undefined,
      after: input.after !== undefined ? (redact(input.after) as Prisma.InputJsonValue) : undefined,
      meta: input.meta !== undefined ? (input.meta as Prisma.InputJsonValue) : undefined,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
