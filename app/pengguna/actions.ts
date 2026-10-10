"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/require-session";
import type { UserGroupRole } from "@/lib/generated/prisma/client";
import { type ActionResult, ValidationError, runAction } from "@/lib/errors";
import type { CreatedUserDto, UserDto } from "@/lib/user/dto";
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

export async function createUserAction(
  _prevState: ActionResult<{ user: CreatedUserDto; temporaryPassword: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ user: CreatedUserDto; temporaryPassword: string }>> {
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
  _prevState: ActionResult<UserDto> | null,
  formData: FormData,
): Promise<ActionResult<UserDto>> {
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
