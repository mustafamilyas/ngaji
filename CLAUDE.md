# Ngaji

Manajemen anggota & kegiatan untuk organisasi berjenjang (pusat → daerah → desa → kelompok).
**`DESIGN.md` adalah sumber kebenaran** untuk skema, matriks izin, logika kegiatan, keamanan, dan halaman. Baca dulu sebelum mengubah model atau alur. Data anggota sensitif (PII): keamanan & audit adalah syarat.

## Stack
- Next.js 15 (App Router, Server Actions, Server Components) + TypeScript, pnpm
- Prisma 6 + SQLite (file lokal, juga dipakai di production — lihat DESIGN.md §8)
- Auth.js v5 Credentials (username + password, tanpa email)
- Tailwind + shadcn/ui, react-hook-form + zod, Recharts, Vitest

## Perintah
```bash
pnpm install
pnpm prisma migrate dev       # migrasi, membuat file SQLite jika belum ada
pnpm prisma db seed           # org + 4 level + contoh pohon + owner admin/admin (wajib ganti password)
pnpm dev
pnpm test                     # vitest: fungsi murni + server action lintas-scope
pnpm lint && pnpm tsc --noEmit
```

## Invarian yang wajib dijaga (server-side)
- Setiap query list difilter **scope** user: `group.path startsWith user.groupPath` (path memuat id sendiri + `/` penutup).
- **Setiap ID dari client** (`groupId`, `memberId`, `activityId`, `occurrenceId`, `userId`, tanggal) di-resolve ke entitasnya di server lalu dicek scope + aturan. Jangan pernah percaya ID/path dari client.
- Semua mutasi lewat `authorize(session, action, target)` di `lib/authz.ts`; entitas di luar scope → 404, bukan 403.
- **Tidak ada hard delete.** `Group`, `Member`, `Activity` soft delete (`deletedAt`); `User` hanya `isActive`. Setiap query ketiga tabel itu wajib `deletedAt: null`.
- **Setiap mutasi menulis `AuditLog` di transaksi yang sama** lewat `audit(tx, …)`. `passwordHash` selalu diredaksi.
- `isActive` dan `role` divalidasi ulang ke DB tiap request di callback `jwt`; jangan percaya JWT untuk keduanya.
- `Group.depth === parent.depth + 1`; anggota hanya boleh di grup daun (depth = level terakhir).
- Kegiatan milik grup X berlaku ke seluruh turunan X. **Ubah** kegiatan/occurrence hanya oleh user ≥ ADMIN yang `groupId === activity.groupId`. **Absensi** hanya oleh user di X atau di bawah X, untuk grup daun dalam scope, tanggal ≤ hari ini, tanggal kunci sah menurut `occurrencesFor`.
- `ActivityOccurrence` dibuat lazy (upsert saat absensi / override). Tidak ada job generator. `date` = tanggal kunci aturan; tanggal efektif = `overrideDate ?? date`.
- Absen = anggota *expected* (`lib/stats.ts`) tanpa baris `Attendance`. Jangan simpan baris "tidak hadir".
- Hapus grup hanya jika kosong (tanpa anak, anggota, kegiatan, user yang belum dihapus).
- Tanggal: kolom `String` (`YYYY-MM-DD`) di DB (SQLite tidak punya tipe DATE native) maupun di seluruh kode — tidak ada konversi Date↔string untuk tanggal murni; `lib/dates.ts` hanya berisi kalkulasi (tambah hari, cari Minggu, dst.) di atas string tersebut. Jam: string `HH:mm`. Satu timezone `Asia/Jakarta`. Minggu dimulai hari Minggu.
- Enum domain (`Role`, `Sex`, `MemberStatus`, dll.) adalah kolom `String` di Prisma (SQLite tidak mendukung `enum`); nilai valid ditegakkan oleh TS union + zod di `lib/validation/enums.ts`, bukan oleh DB. `Activity.weekdays` adalah kolom `Json` (SQLite tidak punya scalar list `Int[]`).

## Konvensi
- UI dalam **Bahasa Indonesia**; kode, nama file, komentar, dan commit dalam **English**.
- Enum & nilai domain memakai istilah Indonesia (`HADIR`, `IZIN`, `AKTIF`, `KELUAR`, `PELAJAR_SMP`, …).
- Skema zod didefinisikan sekali di `lib/validation/*` dan dipakai di form (client) dan Server Action (server).
- Konstanta yang mungkin berubah (kelompok umur, rentang statistik default, ukuran halaman, horizon konflik) di `lib/constants.ts`, bukan hardcode.
- Fungsi murni (`expandDates`, `occurrencesFor`, konflik, `expected`, `authorize`) ditulis dengan tes lebih dulu.
- Log aplikasi tidak memuat PII/password/token. Pesan error ke user generik.
- Mobile-first; halaman absensi harus nyaman dipakai di HP.

## Cara kerja dengan pemilik proyek
- **Jangan berasumsi — tanyakan.** Kalau ada dua tafsir yang menghasilkan pekerjaan berbeda, tanya dulu.
- Fokus MVP (target 2 hari). Fitur non-MVP ada di DESIGN.md §10 — jangan dikerjakan tanpa diminta.
- Kerjakan bertahap sesuai `openspec/changes/ngaji-mvp/tasks.md` (urutan = DESIGN.md §8); spesifikasi & skenario uji per kapabilitas ada di `openspec/changes/ngaji-mvp/specs/`. Gunakan `/opsx:apply` untuk mengerjakan tugas. Setiap tahap harus bisa dijalankan.
- Jika mengubah keputusan desain, perbarui DESIGN.md **dan** spec OpenSpec terkait di commit yang sama.
