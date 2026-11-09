import { z } from "zod";
import { MAX_NAME_LENGTH } from "@/lib/constants";
import { idSchema } from "./common";
import { RELATION_TYPES } from "./enums";

/**
 * Link two members (member-relations spec). For `ORANG_TUA`/`WALI` the `from` member is the
 * parent/guardian; for symmetric types the order does not matter (the server canonicalizes).
 */
export const linkMembersSchema = z.object({
  fromMemberId: idSchema,
  toMemberId: idSchema,
  type: z.enum(RELATION_TYPES, { error: "Jenis hubungan tidak valid" }),
});
export type LinkMembersInput = z.infer<typeof linkMembersSchema>;

export const unlinkMembersSchema = z.object({ relationId: idSchema });
export type UnlinkMembersInput = z.infer<typeof unlinkMembersSchema>;

/** Picker search in the add dialog: name fragment or member code; blank returns nothing. */
export const searchRelativeCandidatesSchema = z.object({
  memberId: idSchema,
  query: z.string().max(MAX_NAME_LENGTH, "Pencarian terlalu panjang"),
});
