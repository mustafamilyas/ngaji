import { z } from "zod";

/**
 * Login form input. No minimum length here: the seeded owner's temporary
 * password ("admin") is shorter than the 8-char floor enforced on new
 * passwords, and login must still be able to compare it against the hash.
 */
export const credentialsSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

/** Floor for any password a user sets going forward (DESIGN.md §4.1). */
export const passwordSchema = z.string().min(8, "Password minimal 8 karakter");
