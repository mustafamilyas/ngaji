import { z } from "zod";
import { TAG_COLORS, TAG_MAX_PART_LENGTH } from "@/lib/constants";
import { idSchema } from "./common";

const PART_PATTERN = /^[a-z0-9_-]+(?: [a-z0-9_-]+)*$/;

export type ParsedTagInput =
  | { ok: true; key: string; value: string | null }
  | { ok: false; error: string };

/** Trim, lowercase and collapse runs of spaces so names cannot differ only by whitespace or case. */
function normalizePart(raw: string): string {
  return raw.trim().toLowerCase().replace(/ {2,}/g, " ");
}

/** Validates one normalized key or value; returns an error message or null. */
function partError(part: string, label: string): string | null {
  if (part === "") return `${label} tag wajib diisi`;
  if (part.length > TAG_MAX_PART_LENGTH) return `${label} tag maksimal ${TAG_MAX_PART_LENGTH} karakter`;
  if (!PART_PATTERN.test(part)) return `${label} tag hanya boleh berisi huruf, angka, spasi, "-" dan "_"`;
  return null;
}

/**
 * Reads what a user typed into a tag input: `fokus` is a simple tag, `a:b` is key `a` with value `b`.
 * Never throws; the caller turns `error` into a validation message.
 */
export function parseTagInput(raw: string): ParsedTagInput {
  const pieces = raw.split(":");
  if (pieces.length > 2) return { ok: false, error: 'Gunakan satu ":" untuk memisahkan kunci dan nilai' };

  const key = normalizePart(pieces[0]);
  const keyError = partError(key, "Nama");
  if (keyError) return { ok: false, error: keyError };
  if (pieces.length === 1) return { ok: true, key, value: null };

  const value = normalizePart(pieces[1]);
  const valueError = partError(value, "Nilai");
  if (valueError) return { ok: false, error: valueError };
  return { ok: true, key, value };
}

/** One normalized key or value typed on its own (rename): same rules as the parts of `parseTagInput`, and no ":". */
function partSchema(label: string) {
  return z.string().transform((raw, ctx) => {
    const part = normalizePart(raw);
    const error = partError(part, label);
    if (error) {
      ctx.addIssue({ code: "custom", message: error });
      return z.NEVER;
    }
    return part;
  });
}

export const tagColorSchema = z.enum(TAG_COLORS, { message: "Warna tidak valid" });

/** A tag name typed by a user, parsed into `{ key, value }`. */
const tagInputSchema = z.string().transform((raw, ctx) => {
  const parsed = parseTagInput(raw);
  if (!parsed.ok) {
    ctx.addIssue({ code: "custom", message: parsed.error });
    return z.NEVER;
  }
  return { key: parsed.key, value: parsed.value };
});

export const createTagSchema = z
  .object({ input: tagInputSchema, color: tagColorSchema })
  .transform(({ input, color }) => ({ key: input.key, value: input.value, color }));
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const recolorTagSchema = z.object({ tagId: idSchema, color: tagColorSchema });
export type RecolorTagInput = z.infer<typeof recolorTagSchema>;

export const deleteTagSchema = z.object({ tagId: idSchema });
export type DeleteTagInput = z.infer<typeof deleteTagSchema>;

export const renameKeySchema = z.object({ tagId: idSchema, newKey: partSchema("Nama") });
export type RenameKeyInput = z.infer<typeof renameKeySchema>;

export const renameValueSchema = z.object({ tagId: idSchema, newValue: partSchema("Nilai") });
export type RenameValueInput = z.infer<typeof renameValueSchema>;
