import { z } from "zod";

/** Shared by group forms and Server Actions (DESIGN.md §2, group-hierarchy spec). */
export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Nama wajib diisi")
  .max(100, "Nama terlalu panjang");

export const createGroupSchema = z.object({
  parentId: z.coerce.number().int().positive(),
  name: groupNameSchema,
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const renameGroupSchema = z.object({
  groupId: z.coerce.number().int().positive(),
  name: groupNameSchema,
});
export type RenameGroupInput = z.infer<typeof renameGroupSchema>;

export const deleteGroupSchema = z.object({
  groupId: z.coerce.number().int().positive(),
});
export type DeleteGroupInput = z.infer<typeof deleteGroupSchema>;
