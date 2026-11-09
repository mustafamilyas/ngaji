import { z } from "zod";
import { DEFAULT_TIMEZONE, TIMEZONES } from "./enums";
import { passwordSchema } from "./auth";
import { usernameSchema } from "./username";

const nameSchema = z.string().trim().min(1, "Nama wajib diisi").max(100, "Nama terlalu panjang");

/** Member code prefix (member-code spec): 2–4 letters A–Z, stored uppercase, set once at creation. */
export const memberCodePrefixSchema = z
  .string({ error: "Prefiks kode anggota wajib diisi" })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,4}$/, "Prefiks kode anggota harus 2–4 huruf A–Z");

/** Settings form + Server Action (organization-settings spec); never carries an organization id. */
export const updateOrganizationSchema = z.object({
  name: nameSchema,
  timezone: z.enum(TIMEZONES, { error: "Zona waktu tidak didukung" }),
});
/** Raw form values: validated (timezone narrowed to `Timezone`) by `updateOrganizationSchema`. */
export type UpdateOrganizationInput = { name: string; timezone: string };

/** Input of `provisionOrganization` (organization-provisioning spec); the CLI builds it from environment variables. */
export const provisionOrganizationSchema = z.object({
  organizationName: nameSchema,
  rootGroupName: nameSchema,
  levelNames: z.array(nameSchema).min(1, "Minimal satu jenjang").max(10, "Terlalu banyak jenjang"),
  timezone: z.enum(TIMEZONES, { error: "Zona waktu tidak didukung" }).default(DEFAULT_TIMEZONE),
  ownerUsername: usernameSchema,
  ownerName: nameSchema,
  ownerPassword: passwordSchema,
  memberCodePrefix: memberCodePrefixSchema,
});
export type ProvisionOrganizationInput = z.input<typeof provisionOrganizationSchema>;
