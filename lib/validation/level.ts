import { z } from "zod";

/** Shared by the level-rename form and its Server Action (DESIGN.md §3.2, §7). */
export const renameLevelSchema = z.object({
  depth: z.coerce.number().int().min(0),
  name: z.string().trim().min(1, "Nama wajib diisi").max(100, "Nama terlalu panjang"),
});
export type RenameLevelInput = z.infer<typeof renameLevelSchema>;
