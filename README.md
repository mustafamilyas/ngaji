# Ngaji

Manajemen anggota & kegiatan untuk organisasi berjenjang (pusat → daerah → desa → kelompok).

Baca [DESIGN.md](DESIGN.md) untuk skema, matriks izin, dan logika kegiatan sebelum mengubah model atau alur.

## Stack

- Next.js 15 (App Router, Server Actions) + TypeScript, pnpm
- Prisma 6 + SQLite (file lokal, juga dipakai di production)
- Auth.js v5 (Credentials: username + password)
- Tailwind + shadcn/ui, Vitest

## Prasyarat

- Node.js 20+ (Node 24 digunakan saat pengembangan)
- pnpm (`corepack enable` lalu `corepack prepare pnpm@10 --activate`, atau `npm i -g pnpm`)

## Setup lokal

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Buat file environment**

   Salin `.env.example` ke `.env` lalu isi `AUTH_SECRET`:

   ```bash
   cp .env.example .env
   ```

   ```bash
   openssl rand -base64 32
   ```

   Tempel hasilnya sebagai nilai `AUTH_SECRET` di `.env`. `DATABASE_URL` sudah diarahkan ke file SQLite lokal (`prisma/dev.db`) dan tidak perlu diubah.

3. **Jalankan migrasi**

   Membuat file SQLite (jika belum ada) dan menerapkan skema:

   ```bash
   pnpm prisma migrate dev
   ```

4. **Seed data**

   Membuat 1 organisasi, 4 level (pusat/daerah/desa/kelompok), contoh pohon grup, ~30 anggota, dan 3 user contoh:

   ```bash
   pnpm prisma db seed
   ```

   Seed gagal (sengaja) jika user `admin` sudah ada — untuk menjalankan ulang dari kosong, reset database dulu:

   ```bash
   pnpm prisma migrate reset
   ```

   `migrate reset` akan drop database, menerapkan ulang semua migrasi, lalu otomatis menjalankan seed di atas.

   Akun contoh hasil seed (**wajib ganti password** setelah login pertama — seed menandai semuanya `mustChangePassword`):

   | Username        | Password  | Role  | Scope                      |
   | --------------- | --------- | ----- | --------------------------- |
   | `admin`          | `admin`    | OWNER | Pusat (seluruh organisasi) |
   | `admin_daerah`   | `admin123` | ADMIN | Daerah Jakarta             |
   | `user_kelompok`  | `user123`  | USER  | Kelompok A (Desa Menteng)  |

5. **Jalankan dev server**

   ```bash
   pnpm dev
   ```

   Buka [http://localhost:3000](http://localhost:3000) dan login dengan salah satu akun di atas.

## Perintah lain

```bash
pnpm test              # vitest: fungsi murni + server action lintas-scope
pnpm lint              # eslint
pnpm tsc --noEmit      # type check
pnpm build             # production build
pnpm start             # jalankan hasil build
```

## Melihat/mengubah data lewat Prisma Studio

```bash
pnpm prisma studio
```

## Catatan

- File `prisma/dev.db` berisi PII (data anggota) dan tidak boleh dikomit — sudah masuk `.gitignore`.
- Tidak ada hard delete: `Group`, `Member`, `Activity` pakai soft delete (`deletedAt`), `User` pakai `isActive`.
- Semua tanggal disimpan sebagai string `YYYY-MM-DD` (SQLite tidak punya tipe `DATE`), timezone `Asia/Jakarta`.
