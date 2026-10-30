# Dahan

Manajemen anggota & kegiatan untuk organisasi berjenjang (pusat → daerah → desa → kelompok). Nama produk **Dahan**; repo, paket, dan identifier kode tetap `ngaji`.
**`DESIGN.md` adalah sumber kebenaran** untuk skema, matriks izin, logika kegiatan, keamanan, dan halaman. Baca dulu sebelum mengubah model atau alur. Data anggota sensitif (PII): keamanan & audit adalah syarat.

## Stack
- Next.js 16 (App Router, Server Actions, Server Components, Turbopack) + TypeScript, pnpm
- Prisma 7 + SQLite via `@prisma/adapter-better-sqlite3` (file lokal, juga dipakai di production — lihat DESIGN.md §8)
- Auth.js v5 Credentials (username + password, tanpa email)
- Tailwind + shadcn/ui, react-hook-form + zod, Recharts, Vitest

## Perintah
```bash
pnpm install
pnpm prisma migrate dev       # migrasi, membuat file SQLite jika belum ada
pnpm prisma db seed           # 2 org (org kedua kecil, owner admin_annur, untuk uji isolasi) + owner admin/admin (wajib ganti password)
pnpm org:create               # org baru + level + grup akar + OWNER pertama (env BOOTSTRAP_*); `pnpm bootstrap` = alias
pnpm leads [--csv]            # daftar minat dari /daftar (hanya-baca)
pnpm audit:viewport          # audit HP/tablet di Chrome headless (db + server sementara); exit 1 jika ada temuan
pnpm audit:print             # cetak jadwal ke PDF lewat Chrome (A4) untuk beberapa skenario; exit 1 jika halaman melebihi anggaran
pnpm dev
pnpm dev:scratch               # dev server di port 3100 dengan database sementara yang sudah di-seed (prisma/dev.db tidak disentuh; login admin/admin; `--keep`, `--port`)
pnpm test                     # vitest: fungsi murni + server action lintas-scope + form klien (jsdom, *.test.tsx, helper lib/test/dom.ts)
pnpm lint && pnpm tsc --noEmit
```

## Invarian yang wajib dijaga (server-side)
- **Multi-organisasi dalam satu DB**: organisasi user = organisasi grupnya, diambil dari sesi (`getOrganization(session)`), bukan "organisasi pertama". Entitas organisasi lain → 404. Username unik global dan selalu huruf kecil. Daftar minat (`InterestLead`) tidak terkait organisasi mana pun dan tidak boleh tampil di halaman/audit organisasi. Detail: DESIGN.md §1.
- Setiap query list difilter **scope** user: `group.path startsWith user.groupPath` (path memuat id sendiri + `/` penutup).
- **Setiap ID dari client** (`groupId`, `memberId`, `activityId`, `occurrenceId`, `userId`, tanggal) di-resolve ke entitasnya di server lalu dicek scope + aturan. Jangan pernah percaya ID/path dari client.
- Semua mutasi lewat `authorize(session, action, target)` di `lib/authz.ts`; entitas di luar scope → 404, bukan 403.
- **Tidak ada hard delete.** `Group`, `Member`, `Activity` soft delete (`deletedAt`); `User` hanya `isActive`. Setiap query ketiga tabel itu wajib `deletedAt: null`.
- **Setiap mutasi menulis `AuditLog` di transaksi yang sama** lewat `audit(tx, …)`. `passwordHash` selalu diredaksi.
- `isActive` dan `role` divalidasi ulang ke DB tiap request di callback `jwt`; jangan percaya JWT untuk keduanya.
- `Group.depth === parent.depth + 1`; anggota hanya boleh di grup daun (depth = level terakhir).
- Kegiatan milik grup X berlaku ke seluruh turunan X. **Ubah** kegiatan/occurrence hanya oleh user dengan peran ADMIN+ di `activity.groupId` (grup sendiri, atau `UserExtraRole` ADMIN; DESIGN.md §3.2a — peran tambahan tidak pernah memperluas scope). **Absensi** hanya oleh user di X atau di bawah X, untuk grup daun dalam scope, tanggal ≤ hari ini (kecuali ≥ ADMIN lewat tabel absensi `setMemberAttendance`), tanggal kunci sah menurut `occurrencesFor`.
- `ActivityOccurrence` dibuat lazy (upsert saat absensi / override). Tidak ada job generator. `date` = tanggal kunci aturan; tanggal efektif = `overrideDate ?? date`.
- Absen = anggota *expected* (`lib/stats.ts`) tanpa baris `Attendance`. Jangan simpan baris "tidak hadir".
- Hapus grup hanya jika kosong (tanpa anak, anggota, kegiatan, user, tag yang belum dihapus).
- Tanggal: kolom `String` (`YYYY-MM-DD`) di DB (SQLite tidak punya tipe DATE native) maupun di seluruh kode — tidak ada konversi Date↔string untuk tanggal murni; `lib/dates.ts` hanya berisi kalkulasi (tambah hari, cari Minggu, dst.) di atas string tersebut. Jam: string `HH:mm`. Zona waktu per organisasi (`session.user.timeZone`, default `Asia/Jakarta`): `today()`/`dateOf()` wajib menerima timezone. Minggu dimulai hari Minggu.
- Enum domain (`Role`, `Sex`, `MemberStatus`, dll.) adalah kolom `String` di Prisma (SQLite tidak mendukung `enum`); nilai valid ditegakkan oleh TS union + zod di `lib/validation/enums.ts`, bukan oleh DB. `Activity.weekdays` adalah kolom `Json` (SQLite tidak punya scalar list `Int[]`).

## Konvensi
- UI dalam **Bahasa Indonesia**; kode, nama file, komentar, dan commit dalam **English**.
- Enum & nilai domain memakai istilah Indonesia (`HADIR`, `IZIN`, `AKTIF`, `KELUAR`, `PELAJAR_SMP`, …).
- Skema zod didefinisikan sekali di `lib/validation/*` dan dipakai di form (client) dan Server Action (server).
- Konstanta yang mungkin berubah (kelompok umur, rentang statistik default, ukuran halaman, horizon konflik) di `lib/constants.ts`, bukan hardcode.
- Fungsi murni (`expandDates`, `occurrencesFor`, konflik, `expected`, `authorize`) ditulis dengan tes lebih dulu.
- Log aplikasi tidak memuat PII/password/token. Pesan error ke user generik.
- Mobile-first; halaman absensi harus nyaman dipakai di HP.
- Ukuran sentuh ada di primitif (`Button`, `Input`, `Textarea`, `Select` di `components/ui`): 44px dan teks 16px di bawah `xl`, ringkas dari `xl`. Jangan menimpa tinggi/teksnya di pemakai; elemen native (`<input>`, `<select>`) memakai `touchField` (`components/ui/touch.ts`). `pnpm audit:viewport` memeriksanya.
- Form dengan Server Action (`useActionState`) dan field tak-terkontrol: kirim lewat `onSubmit={useKeepValues(formAction)}` (`lib/forms/use-keep-values.ts`), bukan `action={formAction}`; React 19 mengosongkan field setelah action, termasuk saat galat, sehingga isian user hilang. Form password sengaja memakai `action` (field dikosongkan).

## Cara kerja dengan pemilik proyek
- **Jangan berasumsi — tanyakan.** Kalau ada dua tafsir yang menghasilkan pekerjaan berbeda, tanya dulu.
- Fokus MVP (target 2 hari). Fitur non-MVP ada di DESIGN.md §10 — jangan dikerjakan tanpa diminta.
- Kerjakan bertahap sesuai `openspec/changes/ngaji-mvp/tasks.md` (urutan = DESIGN.md §8); spesifikasi & skenario uji per kapabilitas ada di `openspec/changes/ngaji-mvp/specs/`. Gunakan `/opsx:apply` untuk mengerjakan tugas. Setiap tahap harus bisa dijalankan.
- **Setiap rilis ke production wajib punya dokumen rilis** di `docs/releases/`, dibuat dari `docs/releases/TEMPLATE.md` sebelum deploy (nama `YYYY-MM-DD-vX.Y.Z.md`), plus baris baru di indeks `docs/releases/README.md`. Prosedur server tetap di `DEPLOYMENT.md`; dokumen rilis hanya memuat hal khusus rilis itu dan hasil sanity check.
- Jika mengubah keputusan desain, perbarui DESIGN.md **dan** spec OpenSpec terkait di commit yang sama.
