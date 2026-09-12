import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { BCRYPT_COST } from "@/lib/constants";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { resolveGroup, resolveUser } from "@/lib/resolve";
import type { Role } from "@/lib/validation/enums";
import type {
  CreateUserInput,
  MoveUserInput,
  ResetUserPasswordInput,
  SetUserActiveInput,
  UpdateUserRoleInput,
} from "@/lib/validation/user";

const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const TEMP_PASSWORD_LENGTH = 12;

/** Server-generated temporary password (user-management spec "Create users"): shown once, never chosen by the caller, never logged. */
function generateTemporaryPassword(): string {
  const bytes = randomBytes(TEMP_PASSWORD_LENGTH);
  let password = "";
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    password += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }
  return password;
}

type UserWithRole = Awaited<ReturnType<typeof resolveUser>>;

/**
 * DESIGN.md §3.2 "Tidak boleh menonaktifkan / menurunkan OWNER aktif
 * terakhir di grup root": true only when `user` is presently the sole
 * active OWNER of their (root, depth 0) group.
 */
async function isLastActiveRootOwner(user: UserWithRole): Promise<boolean> {
  if (!user.role || user.role.role !== "OWNER" || user.role.group.depth !== 0 || !user.isActive) {
    return false;
  }
  const activeOwners = await db.userGroupRole.count({
    where: { groupId: user.role.groupId, role: "OWNER", user: { isActive: true } },
  });
  return activeOwners === 1;
}

function requireRole(user: UserWithRole): asserts user is UserWithRole & { role: NonNullable<UserWithRole["role"]> } {
  if (!user.role) throw new ValidationError("Pengguna belum punya grup");
}

/** OWNER/ADMIN create USER/ADMIN accounts in scope; only OWNER may create OWNER accounts (DESIGN.md §3.2). */
export async function createUser(session: SessionUser, input: CreateUserInput) {
  const group = await resolveGroup(session, input.groupId);
  authorize(session, "user.create", { groupPath: group.path, newRole: input.role });

  const existing = await db.user.findUnique({ where: { username: input.username } });
  if (existing) {
    throw new ValidationError(`Username "${input.username}" sudah dipakai`);
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST);

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { username: input.username, passwordHash, name: input.name, mustChangePassword: true },
    });
    const role = await tx.userGroupRole.create({
      data: { userId: created.id, groupId: group.id, role: input.role },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "user.create",
      entity: "User",
      entityId: created.id,
      groupId: group.id,
      after: { ...created, role: role.role, groupId: role.groupId },
    });
    return created;
  });

  return { user, temporaryPassword };
}

/** OWNER only; self-protection and last-root-OWNER rules enforced by `authorize` (DESIGN.md §3.2). */
export async function updateUserRole(session: SessionUser, input: UpdateUserRoleInput) {
  const user = await resolveUser(session, input.userId);
  requireRole(user);

  const wouldDemoteLastRootOwner = input.role !== "OWNER" && (await isLastActiveRootOwner(user));
  authorize(session, "user.updateRole", {
    userId: user.id,
    groupPath: user.role.group.path,
    isLastActiveRootOwner: wouldDemoteLastRootOwner,
  });

  return db.$transaction(async (tx) => {
    const updated = await tx.userGroupRole.update({
      where: { userId: user.id },
      data: { role: input.role },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "user.update_role",
      entity: "User",
      entityId: user.id,
      groupId: user.role.groupId,
      before: { role: user.role.role },
      after: { role: updated.role },
    });
    return updated;
  });
}

/** OWNER only; destination group resolved (and scope-checked) independently of the user's current group (DESIGN.md §3.2). */
export async function moveUser(session: SessionUser, input: MoveUserInput) {
  const user = await resolveUser(session, input.userId);
  requireRole(user);
  const destination = await resolveGroup(session, input.groupId);

  authorize(session, "user.move", { userId: user.id, groupPath: user.role.group.path });

  return db.$transaction(async (tx) => {
    const updated = await tx.userGroupRole.update({
      where: { userId: user.id },
      data: { groupId: destination.id },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "user.move",
      entity: "User",
      entityId: user.id,
      groupId: destination.id,
      before: { groupId: user.role.groupId },
      after: { groupId: updated.groupId },
    });
    return updated;
  });
}

/** OWNER only; self-protection and last-root-OWNER rules enforced by `authorize` (DESIGN.md §3.2). */
export async function setUserActive(session: SessionUser, input: SetUserActiveInput) {
  const user = await resolveUser(session, input.userId);
  requireRole(user);

  const wouldDeactivateLastRootOwner = !input.isActive && (await isLastActiveRootOwner(user));
  authorize(session, "user.setActive", {
    userId: user.id,
    groupPath: user.role.group.path,
    isLastActiveRootOwner: wouldDeactivateLastRootOwner,
  });

  return db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { isActive: input.isActive },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "user.set_active",
      entity: "User",
      entityId: user.id,
      groupId: user.role.groupId,
      before: { isActive: user.isActive },
      after: { isActive: updated.isActive },
    });
    return updated;
  });
}

/** DESIGN.md §3.4: OWNER resets anyone in scope; ADMIN only a USER in their own group. */
export async function resetUserPassword(session: SessionUser, input: ResetUserPasswordInput) {
  const user = await resolveUser(session, input.userId);
  requireRole(user);

  authorize(session, "user.resetPassword", {
    groupPath: user.role.group.path,
    role: user.role.role as Role,
    groupId: user.role.groupId,
  });

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_COST);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true },
    });
    await audit(tx, {
      actorId: Number(session.id),
      action: "user.reset_password",
      entity: "User",
      entityId: user.id,
      groupId: user.role.groupId,
      meta: { username: user.username },
    });
  });

  return { temporaryPassword };
}
