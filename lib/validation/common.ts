import { z } from "zod";
import { isDateString } from "@/lib/dates";

/** Real calendar date, `YYYY-MM-DD`, year 1900–2100. Rejects instead of normalizing. */
export function dateSchema(message = "Tanggal tidak valid") {
  return z.string().refine((value) => isDateString(value), { message });
}
