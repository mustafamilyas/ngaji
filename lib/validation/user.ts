import { z } from "zod";
import { EXTRA_ROLES, ROLES } from "./enums";
import { usernameSchema } from "./username";

const nameSchema = z.string().trim().min(1, "Nama wajib diisi").max(200, "Nama terlalu panjang");

export const createUserSchema = z.object({
  groupId: z.coerce.number().int().positive(),
  username: usernameSchema,
  name: nameSchema,
  role: z.enum(ROLES),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserRoleSchema = z.object({
  userId: z.coerce.number().int().positive(),
  role: z.enum(ROLES),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const moveUserSchema = z.object({
  userId: z.coerce.number().int().positive(),
  groupId: z.coerce.number().int().positive(),
});
export type MoveUserInput = z.infer<typeof moveUserSchema>;

/**
 * `isActive` arrives as the literal string "true"/"false" from a hidden
 * form field — `z.coerce.boolean()` would treat any non-empty string
 * (including "false") as `true`, so it is matched explicitly instead.
 */
export const setUserActiveSchema = z.object({
  userId: z.coerce.number().int().positive(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});
export type SetUserActiveInput = z.infer<typeof setUserActiveSchema>;

export const resetUserPasswordSchema = z.object({
  userId: z.coerce.number().int().positive(),
});
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;

export const addExtraRoleSchema = z.object({
  userId: z.coerce.number().int().positive(),
  groupId: z.coerce.number().int().positive(),
  role: z.enum(EXTRA_ROLES),
});
export type AddExtraRoleInput = z.infer<typeof addExtraRoleSchema>;

export const removeExtraRoleSchema = z.object({
  userId: z.coerce.number().int().positive(),
  groupId: z.coerce.number().int().positive(),
});
export type RemoveExtraRoleInput = z.infer<typeof removeExtraRoleSchema>;
