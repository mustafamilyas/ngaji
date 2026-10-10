import { z } from "zod";
import { isDateString } from "@/lib/dates";

/** Real calendar date, `YYYY-MM-DD`, year 1900–2100. Rejects instead of normalizing. */
export function dateSchema(message = "Tanggal tidak valid") {
  return z.string().refine((value) => isDateString(value), { message });
}

/** Positive integer id from the client (number or numeric string). Use for ids passed as separate action arguments too. */
export const idSchema = z.coerce.number().int().positive();

/** Optional date: empty string means "not set". */
export function optionalDateSchema(message = "Tanggal tidak valid") {
  return z
    .union([z.literal(""), dateSchema(message)])
    .transform((value) => (value ? value : undefined))
    .optional();
}
