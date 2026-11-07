import { randomInt } from "node:crypto";
import { MEMBER_CODE_LENGTH } from "@/lib/constants";

/** Crockford base32: no I, L, O, U. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const NORMALIZED = new RegExp(`^([A-Z]{2,4})([${ALPHABET}]{${MEMBER_CODE_LENGTH}})$`);

/** Random member code `PREFIX-XXXXXX`. `random(max)` returns an integer in [0, max). */
export function generateMemberCode(prefix: string, random: (max: number) => number = randomInt): string {
  let suffix = "";
  for (let i = 0; i < MEMBER_CODE_LENGTH; i++) suffix += ALPHABET[random(ALPHABET.length)];
  return `${prefix}-${suffix}`;
}

/**
 * Canonical `PREFIX-XXXXXX` for search input, or `null` if the input is not a code.
 * Case, spaces and dashes are ignored; `O`→`0` and `I`/`L`→`1` are mapped in the
 * random part only (a prefix is letters only).
 */
export function normalizeMemberCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, "");
  const split = compact.length - MEMBER_CODE_LENGTH;
  const prefix = compact.slice(0, split);
  const suffix = compact.slice(split).replace(/O/g, "0").replace(/[IL]/g, "1");
  const match = NORMALIZED.exec(prefix + suffix);
  return match ? `${match[1]}-${match[2]}` : null;
}
