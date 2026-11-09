/**
 * Optional columns of the `/dashboard/anggota` table (the name column is always
 * shown). The viewer's choice is kept in a cookie and re-validated here,
 * since cookies are client input. Only chosen columns are rendered, so
 * hidden PII is never sent to the browser.
 */
export const MEMBER_COLUMNS = [
  // First after the name: on a tablet the table scrolls sideways, and the tags must not be the part cut off.
  { key: "tag", label: "Tag", defaultVisible: true },
  { key: "whatsapp", label: "WhatsApp", defaultVisible: true },
  { key: "grup", label: "Grup", defaultVisible: true },
  { key: "jenisKelamin", label: "Jenis kelamin", defaultVisible: true },
  { key: "tanggalLahir", label: "Tanggal lahir", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "kode", label: "Kode", defaultVisible: false },
  { key: "hp", label: "No. HP", defaultVisible: false },
  { key: "tempatLahir", label: "Tempat lahir", defaultVisible: false },
  { key: "alamat", label: "Alamat", defaultVisible: false },
  { key: "statusNikah", label: "Status nikah", defaultVisible: false },
  { key: "pekerjaan", label: "Pekerjaan", defaultVisible: false },
  { key: "email", label: "Email", defaultVisible: false },
  { key: "tanggalMasuk", label: "Tanggal masuk", defaultVisible: false },
] as const;

export type MemberColumnKey = (typeof MEMBER_COLUMNS)[number]["key"];

export const MEMBER_COLUMNS_COOKIE = "anggota_kolom";

export const DEFAULT_MEMBER_COLUMNS: MemberColumnKey[] = MEMBER_COLUMNS.filter((c) => c.defaultVisible).map(
  (c) => c.key,
);

/** Cookie value for "no optional columns" — distinct from "not chosen yet" (absent cookie → defaults). */
const NONE = "none";

export function isMemberColumnKey(value: string): value is MemberColumnKey {
  return MEMBER_COLUMNS.some((c) => c.key === value);
}

export function parseMemberColumns(value: string | undefined): MemberColumnKey[] {
  if (value === undefined) return DEFAULT_MEMBER_COLUMNS;
  if (value === NONE) return [];
  const chosen = new Set(value.split(",").filter(isMemberColumnKey));
  if (chosen.size === 0) return DEFAULT_MEMBER_COLUMNS;
  return MEMBER_COLUMNS.map((c) => c.key).filter((key) => chosen.has(key));
}

export function serializeMemberColumns(columns: readonly MemberColumnKey[]): string {
  return columns.length > 0 ? columns.join(",") : NONE;
}
