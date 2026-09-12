// Single source of truth for domain enum values. SQLite has no Prisma `enum`
// type, so these are plain String columns in prisma/schema.prisma; these
// unions + zod schemas built from them are what actually enforce validity.

export const ROLES = ["OWNER", "ADMIN", "USER"] as const;
export type Role = (typeof ROLES)[number];

export const SEXES = ["L", "P"] as const;
export type Sex = (typeof SEXES)[number];

export const MARITAL_STATUSES = [
  "BELUM_MENIKAH",
  "MENIKAH",
  "CERAI_HIDUP",
  "CERAI_MATI",
] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const WORK_STATUSES = [
  "BEKERJA",
  "TIDAK_BEKERJA",
  "PELAJAR_SD",
  "PELAJAR_SMP",
  "PELAJAR_SMA",
  "MAHASISWA",
  "IBU_RUMAH_TANGGA",
  "PENSIUN",
] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const MEMBER_STATUSES = ["AKTIF", "KELUAR", "PINDAH", "MENINGGAL"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const FREQS = ["ONCE", "DAILY", "WEEKLY", "MONTHLY"] as const;
export type Freq = (typeof FREQS)[number];

export const OCCURRENCE_STATUSES = ["SCHEDULED", "CANCELLED"] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

export const ATTENDANCE_STATUSES = ["HADIR", "IZIN"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
