import { whatsappNumber } from "@/lib/member/whatsapp";

type InterestContact = {
  name: string;
  organizationName: string;
  memberCount?: number | null;
  message?: string | null;
};

/** Prefilled Bahasa Indonesia chat text for the maintainer; absent optional fields are left out. */
export function interestWhatsappText(lead: InterestContact): string {
  const lines = [`Halo, saya ${lead.name} dari ${lead.organizationName}. Saya tertarik mencoba Dahan.`];
  if (lead.memberCount) lines.push(`Jumlah anggota: ${lead.memberCount}`);
  if (lead.message) lines.push(`Pesan: ${lead.message}`);
  return lines.join("\n");
}

/** `wa.me` chat link to `destination` (`DAHAN_WHATSAPP`) with the lead's text; null when the number is missing or invalid. */
export function interestWhatsappUrl(destination: string | undefined, lead: InterestContact): string | null {
  const number = destination ? whatsappNumber(destination) : null;
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(interestWhatsappText(lead))}`;
}
