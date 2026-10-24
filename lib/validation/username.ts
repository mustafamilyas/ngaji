import { z } from "zod";

/**
 * The one username rule (user-management and multi-organization specs):
 * trimmed, stored and looked up in lowercase, so `Budi` and `budi` can never
 * be two accounts. Shared by the user forms, login and the CLI scripts.
 */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username minimal 3 karakter")
  .max(50, "Username terlalu panjang")
  .regex(/^[a-z0-9_.]+$/, "Username hanya boleh huruf, angka, titik, dan garis bawah");
