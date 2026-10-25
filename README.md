# Dahan

Manajemen anggota & kegiatan untuk organisasi berjenjang (pusat → daerah → desa → kelompok). Nama produk: **Dahan**; repo, paket, dan identifier kode tetap `ngaji`.

Baca [DESIGN.md](DESIGN.md) untuk skema, matriks izin, dan logika kegiatan sebelum mengubah model atau alur.

Untuk deployment production (bukan setup lokal), lihat [DEPLOYMENT.md](DEPLOYMENT.md).

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

   Membuat 1 organisasi, 4 level (pusat/daerah/desa/kelompok), contoh pohon grup, ~31 anggota (termasuk kasus tepi: baru gabung, baru keluar, MENINGGAL/PINDAH, satu soft-deleted), 4 user contoh, dan 7 kegiatan contoh (termasuk sepasang yang saling konflik, riwayat absensi, kegiatan yang sudah diakhiri/dipecah/dihapus) untuk mencoba semua alur:

   ```bash
   pnpm prisma db seed
   ```

   Seed gagal (sengaja) jika user `admin` sudah ada — untuk menjalankan ulang dari kosong, reset database dulu:

   ```bash
   pnpm prisma migrate reset
   ```

   `migrate reset` akan drop database, menerapkan ulang semua migrasi, lalu otomatis menjalankan seed di atas.

   Akun contoh hasil seed (**wajib ganti password** setelah login pertama — seed menandai semuanya `mustChangePassword`):

   | Username        | Password      | Role  | Scope                      |
   | --------------- | ------------- | ----- | -------------------------- |
   | `admin`          | `admin`       | OWNER | Pusat (seluruh organisasi) |
   | `admin_daerah`   | `admin123`    | ADMIN | Daerah Jakarta             |
   | `user_kelompok`  | `user123`     | USER  | Kelompok A (Desa Menteng)  |
   | `user_nonaktif`  | `nonaktif123` | USER  | Kelompok B (Desa Menteng) — akun nonaktif (`isActive = false`), untuk mencoba alur login ditolak |

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

## Audit tampilan HP dan tablet

```bash
pnpm audit:viewport                          # owner, 360x740 / 768x1024 / 1024x768
pnpm audit:viewport --roles owner,admin,user # ulangi untuk tiap peran
pnpm audit:viewport --landscape              # tambah 667x375 dan 812x375 (HP landscape)
pnpm audit:viewport --only kegiatan          # hanya halaman yang path-nya memuat teks itu
pnpm audit:viewport --keep-server            # biarkan server dan database sementara tetap hidup
```

Membuka tiap halaman di Chrome headless (lewat DevTools Protocol) dan melaporkan: halaman yang bisa digeser ke samping, target sentuh yang tingginya di bawah 44px, kolom isian dengan teks di bawah 16px (iOS memperbesar layar saat fokus), dan grafik yang tidak ikut menyesuaikan lebar setelah ukuran layar berubah (ukuran diganti tanpa memuat ulang, seperti memutar HP). Exit code 1 jika ada temuan; laporan JSON ditulis ke folder temp.

- Mandiri: skrip membuat database sementara (migrate + seed) dan server `next dev` di port bebas, lalu menghapusnya. `prisma/dev.db` tidak disentuh.
- Perlu Google Chrome (atau set `CHROME_PATH`) dan Node 22+.
- Dialog, popover, dan dropdown yang terbuka tidak tercakup karena perlu klik dulu; periksa manual.
- Pane Browser di aplikasi desktop yang tersembunyi tidak menjalankan `ResizeObserver` atau animasi, jadi hasil ukuran grafik di sana bisa menyesatkan; skrip ini tidak punya masalah itu.

## Melihat/mengubah data lewat Prisma Studio

```bash
pnpm prisma studio
```

## Catatan

- File `prisma/dev.db` berisi PII (data anggota) dan tidak boleh dikomit — sudah masuk `.gitignore`.
- Tidak ada hard delete: `Group`, `Member`, `Activity` pakai soft delete (`deletedAt`), `User` pakai `isActive`.
- Semua tanggal disimpan sebagai string `YYYY-MM-DD` (SQLite tidak punya tipe `DATE`), timezone `Asia/Jakarta`.
