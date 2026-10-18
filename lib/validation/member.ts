import { z } from "zod";
import { MAX_NAME_LENGTH } from "@/lib/constants";
import { dateSchema, optionalDateSchema } from "./common";
import { MARITAL_STATUSES, MEMBER_STATUSES, SEXES, WORK_STATUSES } from "./enums";

/** Shared by the member forms and Server Actions (DESIGN.md §2, member-management spec). */
const memberFieldsSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(MAX_NAME_LENGTH),
  birthPlace: z.string().trim().min(1, "Tempat lahir wajib diisi").max(100),
  birthDate: dateSchema("Tanggal lahir tidak valid"),
  sex: z.enum(SEXES),
  address: z.string().trim().min(1, "Alamat wajib diisi").max(500),
  phone: z.string().trim().min(1, "Nomor HP wajib diisi").max(30),
  maritalStatus: z.enum(MARITAL_STATUSES),
  workStatus: z.enum(WORK_STATUSES),
  email: z
    .union([z.literal(""), z.string().trim().email("Email tidak valid")])
    .transform((value) => (value ? value : undefined))
    .optional(),
  status: z.enum(MEMBER_STATUSES),
  joinedAt: dateSchema("Tanggal bergabung tidak valid"),
  exitedAt: optionalDateSchema("Tanggal keluar tidak valid"),
});

function requireExitedAtWhenNotActive(
  data: { status: string; exitedAt?: string },
  ctx: z.RefinementCtx,
) {
  if (data.status !== "AKTIF" && !data.exitedAt) {
    ctx.addIssue({
      code: "custom",
      path: ["exitedAt"],
      message: "Tanggal keluar wajib diisi jika status bukan AKTIF",
    });
  }
}

export const createMemberSchema = memberFieldsSchema
  .extend({ groupId: z.coerce.number().int().positive() })
  .superRefine(requireExitedAtWhenNotActive);
export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = memberFieldsSchema
  .extend({ memberId: z.coerce.number().int().positive() })
  .superRefine(requireExitedAtWhenNotActive);
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const deleteMemberSchema = z.object({
  memberId: z.coerce.number().int().positive(),
});
export type DeleteMemberInput = z.infer<typeof deleteMemberSchema>;

/** Form-side schema (react-hook-form resolver): same shape, `joinedAt` defaulted by the form, not here. */
export const memberFormSchema = memberFieldsSchema;
export type MemberFormValues = z.infer<typeof memberFormSchema>;
