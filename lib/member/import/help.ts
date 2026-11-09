import { MARITAL_STATUSES, MEMBER_STATUSES, SEXES, WORK_STATUSES } from "@/lib/validation/enums";
import type { ImportColumnKey } from "./columns";

const DATE_RULE = "Format YYYY-MM-DD, atau hari/bulan/tahun seperti 05/03/1990 (hari lebih dulu)";
const LABELS_TOO = "Nama dalam huruf biasa juga diterima";

/** One line per column for the import page. A Record, so a column added to `columns.ts` without help fails typecheck. */
export const COLUMN_HELP: Record<ImportColumnKey, string> = {
  nama: "Nama lengkap.",
  tempat_lahir: "Kota atau tempat lahir.",
  tanggal_lahir: `${DATE_RULE}. Tahun dua digit dan angka serial Excel ditolak.`,
  jenis_kelamin: `${SEXES.join(" atau ")}. Laki-laki dan Perempuan juga diterima.`,
  alamat: "Alamat lengkap.",
  status_nikah: `${MARITAL_STATUSES.join(", ")}. ${LABELS_TOO}.`,
  pekerjaan: `${WORK_STATUSES.join(", ")}. ${LABELS_TOO}.`,
  no_hp: "Boleh kosong. Simpan kolom sebagai teks agar angka 0 di depan tidak hilang dan nomor panjang tidak menjadi 6.28E+11.",
  email: "Boleh kosong.",
  status: `${MEMBER_STATUSES.join(", ")}. Kosong berarti AKTIF.`,
  tanggal_masuk: `${DATE_RULE}. Kosong berarti hari ini.`,
  tanggal_keluar: `${DATE_RULE}. Wajib jika status bukan AKTIF.`,
  grup: "Boleh tidak ada. Isi dengan nama kelompok di lingkup Anda; kolom ini menggantikan grup tujuan dan wajib terisi di setiap baris. Nama yang sama di beberapa kelompok ditolak, pisahkan filenya.",
};
