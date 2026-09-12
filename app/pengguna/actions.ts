"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { User, UserGroupRole } from "@/lib/generated/prisma/client";
import { type ActionResult, ValidationError, runAction } from "@/lib/errors";
import {
  createUser,
  moveUser,
  resetUserPassword,
  setUserActive,
  updateUserRole,
} from "@/lib/user/mutations";
import {
  createUserSchema,
  moveUserSchema,
  resetUserPasswordSchema,
  setUserActiveSchema,
  updateUserRoleSchema,
} from "@/lib/validation/user";

async function requireSession() {
  const session = await auth();
  if (!session) redirect("/login");
  return session.user;
}

export async function createUserAction(
  _prevState: ActionResult<{ user: User; temporaryPassword: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ user: User; temporaryPassword: string }>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = createUserSchema.safeParse({
      groupId: formData.get("groupId"),
      username: formData.get("username"),
      name: formData.get("name"),
      role: formData.get("role"),
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return createUser(session, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/pengguna");
  }
  return result;
}

export async function updateUserRoleAction(
  _prevState: ActionResult<UserGroupRole> | null,
  formData: FormData,
): Promise<ActionResult<UserGroupRole>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = updateUserRoleSchema.safeParse({
      userId: formData.get("userId"),
      role: formData.get("role"),
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return updateUserRole(session, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/pengguna");
  }
  return result;
}

export async function moveUserAction(
  _prevState: ActionResult<UserGroupRole> | null,
  formData: FormData,
): Promise<ActionResult<UserGroupRole>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = moveUserSchema.safeParse({
      userId: formData.get("userId"),
      groupId: formData.get("groupId"),
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return moveUser(session, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/pengguna");
  }
  return result;
}

export async function setUserActiveAction(
  _prevState: ActionResult<User> | null,
  formData: FormData,
): Promise<ActionResult<User>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = setUserActiveSchema.safeParse({
      userId: formData.get("userId"),
      isActive: formData.get("isActive"),
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return setUserActive(session, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/pengguna");
  }
  return result;
}

export async function resetUserPasswordAction(
  _prevState: ActionResult<{ temporaryPassword: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ temporaryPassword: string }>> {
  const session = await requireSession();
  const result = await runAction(async () => {
    const parsed = resetUserPasswordSchema.safeParse({ userId: formData.get("userId") });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return resetUserPassword(session, parsed.data);
  });
  if (result.ok) {
    revalidatePath("/pengguna");
  }
  return result;
}
