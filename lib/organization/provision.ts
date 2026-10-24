import bcrypt from "bcrypt";
import { audit, type AuditTransactionClient } from "@/lib/audit";
import { BCRYPT_COST } from "@/lib/constants";
import type { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { provisionOrganizationSchema } from "@/lib/validation/organization";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export type ProvisionedOrganization = {
  organizationId: number;
  rootGroupId: number;
  ownerId: number;
};

/**
 * Creates an organization with its levels, root group and first OWNER
 * (organization-provisioning spec). Validates the whole input before the
 * first write and throws `ValidationError`; run it inside one
 * `db.$transaction` so any failure leaves nothing behind. Unlike a user
 * request it has no actor: audits carry `actorId = null`.
 */
export async function provisionOrganization(tx: Tx, rawInput: unknown): Promise<ProvisionedOrganization> {
  const parsed = provisionOrganizationSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);
  const input = parsed.data;

  const taken = await tx.user.findUnique({ where: { username: input.ownerUsername }, select: { id: true } });
  if (taken) throw new ValidationError(`Username "${input.ownerUsername}" sudah dipakai`);

  const organization = await tx.organization.create({
    data: { name: input.organizationName, timezone: input.timezone },
  });
  await tx.level.createMany({
    data: input.levelNames.map((name, depth) => ({ organizationId: organization.id, depth, name })),
  });

  const created = await tx.group.create({
    data: { organizationId: organization.id, parentId: null, depth: 0, name: input.rootGroupName, path: "" },
  });
  const rootGroup = await tx.group.update({ where: { id: created.id }, data: { path: `${created.id}/` } });

  const passwordHash = await bcrypt.hash(input.ownerPassword, BCRYPT_COST);
  const owner = await tx.user.create({
    data: { username: input.ownerUsername, passwordHash, name: input.ownerName, mustChangePassword: true },
  });
  await tx.userGroupRole.create({ data: { userId: owner.id, groupId: rootGroup.id, role: "OWNER" } });

  const auditTx = tx as unknown as AuditTransactionClient;
  await audit(auditTx, {
    actorId: null,
    action: "organization.create",
    entity: "Organization",
    entityId: organization.id,
    groupId: rootGroup.id,
    after: {
      name: organization.name,
      timezone: organization.timezone,
      levels: input.levelNames,
      rootGroupId: rootGroup.id,
    },
  });
  await audit(auditTx, {
    actorId: null,
    action: "user.create",
    entity: "User",
    entityId: owner.id,
    groupId: rootGroup.id,
    after: { username: owner.username, name: owner.name, role: "OWNER", mustChangePassword: true },
  });

  return { organizationId: organization.id, rootGroupId: rootGroup.id, ownerId: owner.id };
}
