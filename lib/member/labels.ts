import type { Sex } from "@/lib/validation/enums";

/** "BELUM_MENIKAH" -> "Belum Menikah" for enum values whose constant name already reads as Indonesian words. */
export function formatEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const SEX_LABELS: Record<Sex, string> = { L: "Laki-laki", P: "Perempuan" };

export const MEMBER_STATUS_LABELS = {
  AKTIF: "Aktif",
  KELUAR: "Keluar",
  PINDAH: "Pindah",
  MENINGGAL: "Meninggal",
} as const;
