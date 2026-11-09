import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { updateOrganizationSchema, type UpdateOrganizationInput } from "@/lib/validation/organization";

/**
 * Root OWNER changes their own organization's name and timezone
 * (organization-settings spec). The organization comes from the caller's
 * group, never from input. Audits only the fields that changed; a save that
 * changes nothing writes nothing.
 */
export async function updateOrganization(session: SessionUser, rawInput: UpdateOrganizationInput) {
  authorize(session, "organization.update");

  const parsed = updateOrganizationSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
  const input = parsed.data;

  const rootGroup = await db.group.findUnique({ where: { id: session.groupId } });
  if (!rootGroup) throw new NotFoundError();

  return db.$transaction(async (tx) => {
    const current = await tx.organization.findUnique({ where: { id: rootGroup.organizationId } });
    if (!current) throw new NotFoundError();

    const before: Record<string, string> = {};
    const after: Record<string, string> = {};
    if (current.name !== input.name) {
      before.name = current.name;
      after.name = input.name;
    }
    if (current.timezone !== input.timezone) {
      before.timezone = current.timezone;
      after.timezone = input.timezone;
    }
    if (Object.keys(after).length === 0) return current;

    const updated = await tx.organization.update({ where: { id: current.id }, data: after });
    await audit(tx, {
      actorId: Number(session.id),
      action: "organization.update",
      entity: "Organization",
      entityId: current.id,
      groupId: rootGroup.id,
      before,
      after,
    });
    return updated;
  });
}
