import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session-user";
import { authorize } from "@/lib/authz";
import { BCRYPT_COST } from "@/lib/constants";
import { db } from "@/lib/db";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { resolveGroup, resolveUser } from "@/lib/resolve";
import { toCreatedUserDto, toUserDto } from "./dto";
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
export function generateTemporaryPassword(): string {
  const bytes = randomBytes(TEMP_PASSWORD_LENGTH);
  let password = "";
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    password += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }
  return password;
}

type UserWithRole = Awaited<ReturnType<typeof resolveUser>>;

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** True when `user` is currently an active OWNER of a root (depth 0) group. */
function isActiveRootOwner(user: UserWithRole): boolean {
  return Boolean(user.isActive && user.role?.role === "OWNER" && user.role.group.depth === 0);
}

/**
 * DESIGN.md §3.2 "Tidak boleh menonaktifkan / menurunkan OWNER aktif
 * terakhir di grup root", checked AFTER the write and inside its
 * transaction: SQLite serializes write transactions, so of two concurrent
 * requests the second sees the first's commit, finds no owner left and
 * throws, which rolls its own write back. A pre-check outside the
 * transaction would let both pass.
 */
async function assertRootOwnerRemains(tx: Tx, rootGroupId: number): Promise<void> {
  const remaining = await tx.userGroupRole.count({
    where: { groupId: rootGroupId, role: "OWNER", user: { isActive: true } },
  });
  if (remaining === 0) throw new ForbiddenError();
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
    return toCreatedUserDto(created, role as { role: Role; groupId: number });
  });

  return { user, temporaryPassword };
}

/** OWNER only; self-protection and last-root-OWNER rules enforced by `authorize` (DESIGN.md §3.2). */
export async function updateUserRole(session: SessionUser, input: UpdateUserRoleInput) {
  const user = await resolveUser(session, input.userId);
  requireRole(user);

  authorize(session, "user.updateRole", { userId: user.id, groupPath: user.role.group.path });

  return db.$transaction(async (tx) => {
    const updated = await tx.userGroupRole.update({
      where: { userId: user.id },
      data: { role: input.role },
    });
    if (isActiveRootOwner(user) && input.role !== "OWNER") {
      await assertRootOwnerRemains(tx, user.role.groupId);
    }
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
    if (isActiveRootOwner(user)) {
      await assertRootOwnerRemains(tx, user.role.groupId);
    }
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

  authorize(session, "user.setActive", { userId: user.id, groupPath: user.role.group.path });

  return db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { isActive: input.isActive },
    });
    if (isActiveRootOwner(user) && !input.isActive) {
      await assertRootOwnerRemains(tx, user.role.groupId);
    }
    await audit(tx, {
      actorId: Number(session.id),
      action: "user.set_active",
      entity: "User",
      entityId: user.id,
      groupId: user.role.groupId,
      before: { isActive: user.isActive },
      after: { isActive: updated.isActive },
    });
    return toUserDto(updated);
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
      data: { passwordHash, mustChangePassword: true, sessionVersion: { increment: 1 } },
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
