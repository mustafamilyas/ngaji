import { z } from "zod";
import { DEFAULT_TIMEZONE, TIMEZONES } from "./enums";
import { passwordSchema } from "./auth";
import { usernameSchema } from "./username";

const nameSchema = z.string().trim().min(1, "Nama wajib diisi").max(100, "Nama terlalu panjang");

/** Input of `provisionOrganization` (organization-provisioning spec); the CLI builds it from environment variables. */
export const provisionOrganizationSchema = z.object({
  organizationName: nameSchema,
  rootGroupName: nameSchema,
  levelNames: z.array(nameSchema).min(1, "Minimal satu jenjang").max(10, "Terlalu banyak jenjang"),
  timezone: z.enum(TIMEZONES, { error: "Zona waktu tidak didukung" }).default(DEFAULT_TIMEZONE),
  ownerUsername: usernameSchema,
  ownerName: nameSchema,
  ownerPassword: passwordSchema,
});
export type ProvisionOrganizationInput = z.input<typeof provisionOrganizationSchema>;
