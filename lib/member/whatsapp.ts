const MIN_DIGITS = 10;
const MAX_DIGITS = 15; // E.164 maximum

/**
 * `Member.phone` is free text ("0812-3456-7890", "+62 812…"); WhatsApp's
 * click-to-chat needs the bare international number. Indonesian forms
 * (0…, 62…, +62…, or a bare 8…) become 62…; any other number must be
 * written with "+" to be trusted as international. Null when unusable.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const trimmed = (phone ?? "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let normalized: string;
  if (trimmed.startsWith("+")) normalized = digits;
  else if (digits.startsWith("62")) normalized = digits;
  else if (digits.startsWith("0")) normalized = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) normalized = `62${digits}`;
  else return null;

  return normalized.length >= MIN_DIGITS && normalized.length <= MAX_DIGITS ? normalized : null;
}

export function whatsappUrl(phone: string | null | undefined): string | null {
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}` : null;
}
