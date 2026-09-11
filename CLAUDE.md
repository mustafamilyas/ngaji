# Ngaji

Manajemen anggota & kegiatan untuk organisasi berjenjang (pusat → daerah → desa → kelompok).
**`DESIGN.md` adalah sumber kebenaran** untuk skema, matriks izin, logika kegiatan, dan halaman. Baca dulu sebelum mengubah model atau alur.

## Stack
- Next.js 15 (App Router, Server Actions, Server Components) + TypeScript, pnpm
- Prisma 6 + PostgreSQL 16 (docker-compose lokal)
- Auth.js v5 Credentials (username + password, tanpa email)
- Tailwind + shadcn/ui, react-hook-form + zod, Recharts

## Perintah
```bash
docker compose up -d          # Postgres
pnpm install
pnpm prisma migrate dev       # migrasi
pnpm prisma db seed           # org + 4 level + contoh pohon + owner admin/admin
pnpm dev
pnpm lint && pnpm tsc --noEmit
```

## Invarian yang wajib dijaga (server-side)
- Setiap query list & mutasi difilter **scope** user: `group.path startsWith user.groupPath`. Jangan pernah percaya `groupId` dari client tanpa cek scope.
- Semua mutasi lewat `authorize(user, action, targetGroupId)` di `lib/authz.ts`.
- `Group.depth === parent.depth + 1`; anggota hanya boleh di grup daun (depth = level terakhir).
- Kegiatan milik grup X berlaku ke seluruh turunan X; hanya bisa diedit jika `activity.groupId` dalam scope user dan peran ≥ ADMIN.
- `ActivityOccurrence` dibuat lazy (upsert saat absensi / override). Tidak ada job generator.
- Absen = anggota AKTIF tanpa baris `Attendance`. Jangan simpan baris "tidak hadir".
- Hapus grup hanya jika kosong (tanpa anak, anggota, kegiatan, user). Soft delete.
- Tanggal: `@db.Date`; jam: string `HH:mm`; satu timezone `Asia/Jakarta`.

## Konvensi
- UI dalam **Bahasa Indonesia**; kode, nama file, komentar, dan commit dalam **English**.
- Enum & nilai domain memakai istilah Indonesia (`HADIR`, `IZIN`, `AKTIF`, `KELUAR`, `PELAJAR_SMP`, …).
- Skema zod didefinisikan sekali di `lib/validation/*` dan dipakai di form (client) dan Server Action (server).
- Konstanta yang mungkin berubah (kelompok umur, rentang statistik default) di `lib/constants.ts`, bukan hardcode.
- Mobile-first; halaman absensi harus nyaman dipakai di HP.

## Cara kerja dengan pemilik proyek
- **Jangan berasumsi — tanyakan.** Kalau ada dua tafsir yang menghasilkan pekerjaan berbeda, tanya dulu.
- Fokus MVP (target 1 hari). Fitur non-MVP ada di DESIGN.md §9 — jangan dikerjakan tanpa diminta.
- Kerjakan bertahap per fitur sesuai urutan DESIGN.md §7; setiap tahap harus bisa dijalankan.
- Jika mengubah keputusan desain, perbarui DESIGN.md di commit yang sama.
