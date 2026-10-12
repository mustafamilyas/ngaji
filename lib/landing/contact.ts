import { whatsappUrl } from "@/lib/member/whatsapp";

/**
 * Click-to-chat link for the landing-page CTA, from `DAHAN_WHATSAPP`
 * (deployment config, read at request time). Null hides the CTA.
 */
export function contactWhatsappUrl(): string | null {
  const phone = process.env.DAHAN_WHATSAPP;
  return phone ? whatsappUrl(phone) : null;
}
