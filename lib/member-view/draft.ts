import { VIEW_MAX_DRAFT_LENGTH } from "@/lib/constants";
import { parseDefinitionLenient, type Definition, type DefinitionWarning } from "@/lib/validation/member-view";

/**
 * Unsaved view edits live in the URL as `?d=<base64url(JSON)>` (design §6).
 * Works in the browser and on the server (no Buffer). Decoding is lenient and
 * never throws; the result is still client input and is re-validated again
 * (including group ids) before any query.
 */

export type DecodedDraft = { ok: true; definition: Definition; warnings: DefinitionWarning[] } | { ok: false };

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** `null` when the encoded draft would exceed `VIEW_MAX_DRAFT_LENGTH`. */
export function encodeDraft(definition: Definition): string | null {
  const encoded = toBase64Url(JSON.stringify(definition));
  return encoded.length <= VIEW_MAX_DRAFT_LENGTH ? encoded : null;
}

export function decodeDraft(value: string | undefined): DecodedDraft {
  if (!value || value.length > VIEW_MAX_DRAFT_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) return { ok: false };
  try {
    const { definition, warnings } = parseDefinitionLenient(JSON.parse(fromBase64Url(value)));
    return warnings.includes("definition_invalid") ? { ok: false } : { ok: true, definition, warnings };
  } catch {
    return { ok: false };
  }
}
