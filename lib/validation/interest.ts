import { z } from "zod";
import { INTEREST_MAX_FIELD_LENGTH, INTEREST_MAX_MEMBER_COUNT, INTEREST_MAX_MESSAGE_LENGTH } from "@/lib/constants";
import { whatsappNumber } from "@/lib/member/whatsapp";

/** Shared by the /daftar form and the public `submitInterest` action (interest-signup spec). */
const memberCountSchema = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    if (typeof value === "string") return /^\d+$/.test(value.trim()) ? Number(value) : Number.NaN;
    return value;
  },
  z
    .number("Jumlah anggota harus berupa angka")
    .int("Jumlah anggota harus bilangan bulat")
    .min(1, "Jumlah anggota minimal 1")
    .max(INTEREST_MAX_MEMBER_COUNT, "Jumlah anggota terlalu besar")
    .optional(),
);

export const interestSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(INTEREST_MAX_FIELD_LENGTH, "Nama terlalu panjang"),
  phone: z
    .string()
    .trim()
    .max(30, "Nomor WhatsApp tidak valid")
    .refine((value) => whatsappNumber(value) !== null, "Nomor WhatsApp tidak valid"),
  organizationName: z
    .string()
    .trim()
    .min(1, "Nama organisasi wajib diisi")
    .max(INTEREST_MAX_FIELD_LENGTH, "Nama organisasi terlalu panjang"),
  memberCount: memberCountSchema,
  message: z
    .string()
    .trim()
    .max(INTEREST_MAX_MESSAGE_LENGTH, "Pesan terlalu panjang")
    .transform((value) => value || undefined)
    .optional(),
  consent: z.literal(true, "Persetujuan wajib dicentang"),
  /** Honeypot: hidden from people; the action drops any submission where it is filled. */
  website: z.string().optional(),
});
export type InterestInput = z.infer<typeof interestSchema>;
