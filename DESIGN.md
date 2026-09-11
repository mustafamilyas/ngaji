# Ngaji — Desain MVP

Aplikasi manajemen anggota & kegiatan untuk organisasi berjenjang
(pusat → daerah → desa → kelompok).

Stack: **Next.js (App Router, Server Actions) + Prisma + PostgreSQL**, UI Bahasa Indonesia, mobile-first.

---

## 1. Keputusan yang sudah disepakati

| Topik | Keputusan |
|---|---|
| Tenancy | Satu organisasi per deployment. Owner pertama dibuat lewat seed. Tabel `Organization` tetap ada agar mudah multi-tenant nanti. |
| Jenjang grup | Level tetap & berurutan, tidak boleh loncat. Nama level bisa diganti (`pusat`, `daerah`, `desa`, `kelompok`). |
| Anggota | Hanya di grup **daun** (level terakhir). Keluar = ubah `status`, bukan hapus / null grup. |
| Peran | `OWNER`, `ADMIN`, `USER`. Satu user = satu grup + satu peran (MVP). Semua peran boleh CRUD anggota. |
| Login | Username + password. Reset password oleh owner/admin. Tanpa email. |
| Kegiatan | Aturan berulang sederhana; baris occurrence dibuat **lazy** hanya saat absensi diisi / occurrence diubah. |
| Konflik | Peringatan jika jam bertabrakan; tetap boleh disimpan. Perlu `durationMinutes`. |
| Absensi | `HADIR` / `IZIN`; tidak ada baris = tidak hadir. |

---

## 2. Model data (Prisma)

```prisma
enum Role            { OWNER ADMIN USER }
enum Sex             { L P }
enum MaritalStatus   { BELUM_MENIKAH MENIKAH CERAI_HIDUP CERAI_MATI }
enum WorkStatus      { BEKERJA TIDAK_BEKERJA PELAJAR_SD PELAJAR_SMP PELAJAR_SMA MAHASISWA IBU_RUMAH_TANGGA PENSIUN }
enum MemberStatus    { AKTIF KELUAR PINDAH MENINGGAL }
enum Freq            { ONCE DAILY WEEKLY MONTHLY }
enum OccurrenceStatus{ SCHEDULED CANCELLED }
enum AttendanceStatus{ HADIR IZIN }

model Organization {
  id        Int      @id @default(autoincrement())
  name      String
  timezone  String   @default("Asia/Jakarta")
  levels    Level[]
  groups    Group[]
}

/// Nama jenjang, depth 0 = root. Rename level = ubah satu baris.
model Level {
  id             Int          @id @default(autoincrement())
  organizationId Int
  depth          Int
  name           String
  organization   Organization @relation(fields: [organizationId], references: [id])
  @@unique([organizationId, depth])
}

model Group {
  id             Int       @id @default(autoincrement())
  organizationId Int
  parentId       Int?
  depth          Int                      // harus = parent.depth + 1
  name           String
  path           String                   // materialized path: "1/5/12/"
  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  parent         Group?    @relation("tree", fields: [parentId], references: [id])
  children       Group[]   @relation("tree")
  members        Member[]
  activities     Activity[]
  userRoles      UserGroupRole[]

  @@index([path])
  @@index([parentId])
}

model User {
  id           Int      @id @default(autoincrement())
  username     String   @unique
  passwordHash String
  name         String
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  role         UserGroupRole?
}

/// MVP: @@unique([userId]). Non-MVP multi-peran = hapus unique ini saja.
model UserGroupRole {
  id      Int   @id @default(autoincrement())
  userId  Int   @unique
  groupId Int
  role    Role
  user    User  @relation(fields: [userId], references: [id])
  group   Group @relation(fields: [groupId], references: [id])
  @@index([groupId])
}

model Member {
  id            Int           @id @default(autoincrement())
  groupId       Int                          // wajib grup daun
  name          String
  birthPlace    String
  birthDate     DateTime      @db.Date
  sex           Sex
  address       String
  phone         String                       // TIDAK unique (satu HP bisa dipakai sekeluarga)
  maritalStatus MaritalStatus
  workStatus    WorkStatus
  email         String?
  status        MemberStatus  @default(AKTIF)
  exitedAt      DateTime?
  createdById   Int
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  group       Group        @relation(fields: [groupId], references: [id])
  attendances Attendance[]

  @@index([groupId, status])
  @@index([name])
}

/// Template kegiatan. Dimiliki satu grup; otomatis berlaku ke semua turunannya.
model Activity {
  id              Int       @id @default(autoincrement())
  groupId         Int
  name            String
  location        String
  notes           String?
  startTime       String                    // "HH:mm" waktu lokal organisasi
  durationMinutes Int
  freq            Freq
  interval        Int       @default(1)     // tiap N hari/minggu/bulan
  weekdays        Int[]                     // WEEKLY: 0=Minggu..6=Sabtu
  monthDay        Int?                      // MONTHLY: tanggal 1..31
  startsOn        DateTime  @db.Date
  endsOn          DateTime? @db.Date        // null = tanpa akhir; ONCE: = startsOn
  createdById     Int
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  group       Group                @relation(fields: [groupId], references: [id])
  occurrences ActivityOccurrence[]

  @@index([groupId])
}

/// Dibuat lazy: hanya saat ada absensi atau override (batal / ganti jam / lokasi).
model ActivityOccurrence {
  id                Int              @id @default(autoincrement())
  activityId        Int
  date              DateTime         @db.Date
  status            OccurrenceStatus @default(SCHEDULED)
  overrideStartTime String?
  overrideLocation  String?
  overrideNotes     String?

  activity    Activity     @relation(fields: [activityId], references: [id])
  attendances Attendance[]

  @@unique([activityId, date])
}

model Attendance {
  id           Int              @id @default(autoincrement())
  occurrenceId Int
  memberId     Int
  status       AttendanceStatus
  recordedById Int
  recordedAt   DateTime         @default(now())

  occurrence ActivityOccurrence @relation(fields: [occurrenceId], references: [id])
  member     Member             @relation(fields: [memberId], references: [id])

  @@unique([occurrenceId, memberId])
  @@index([memberId])
}
```

### Catatan model
- **Materialized path** (`path`) dipilih daripada recursive CTE agar query turunan cukup `startsWith` di Prisma. Pindah grup ke parent lain = tulis ulang path subtree — **tidak ada di MVP**.
- **Hapus grup** hanya jika tidak punya anak, anggota, kegiatan, dan user. Soft delete.
- Absen = anggota AKTIF di scope occurrence yang **tidak punya** baris Attendance.
- Tidak ada riwayat pindah grup anggota (MVP). Statistik partisipasi memakai grup saat ini.

---

## 3. Aturan akses

### Scope
Setiap user punya satu `UserGroupRole (groupId, role)`. **Scope** = grup itu + semua turunannya
(`group.path startsWith scopeGroup.path`). Semua query wajib difilter scope di server.

### Matriks izin

| Aksi | OWNER | ADMIN | USER |
|---|:-:|:-:|:-:|
| Lihat grup, anggota, kegiatan, statistik dalam scope | ✅ | ✅ | ✅ |
| Buat / ubah / hapus anggota dalam scope | ✅ | ✅ | ✅ |
| Isi absensi dalam scope | ✅ | ✅ | ✅ |
| Buat / rename / hapus sub-grup dalam scope | ✅ | ✅ | ❌ |
| Buat / ubah / hapus kegiatan milik grup dalam scope | ✅ | ✅ | ❌ |
| Batalkan / geser satu occurrence | ✅ | ✅ | ❌ |
| Buat user USER / ADMIN untuk grup dalam scope, reset password mereka | ✅ | ✅ | ❌ |
| Buat user OWNER, turunkan ADMIN, nonaktifkan user | ✅ | ❌ | ❌ |
| Ganti nama jenjang (Level) | ✅ root saja | ❌ | ❌ |

### Kegiatan warisan
- Kegiatan milik grup X **berlaku** untuk X dan semua turunan X.
- Kegiatan tampil di grup Y jika `activity.groupId ∈ ancestors(Y) ∪ {Y}`.
- **Bisa diedit** hanya jika `activity.groupId` ada dalam scope user **dan** peran ≥ ADMIN.
  Contoh: admin kelompok melihat "Senam" milik daerah, bisa isi absensi, **tidak** bisa ubah jam.
- Tidak ada opt-out: sub-grup tidak bisa menonaktifkan kegiatan warisan (MVP).

Implementasi: satu helper `authorize(user, action, targetGroupId)` yang dipanggil di setiap Server Action; helper `visibleGroupIds(user)` / filter `path startsWith` untuk semua query list.

---

## 4. Logika kegiatan

### Ekspansi occurrence (fungsi murni)
```
expandDates(activity, from, to): Date[]
  ONCE    → [startsOn] jika dalam rentang
  DAILY   → tiap `interval` hari dari startsOn
  WEEKLY  → tiap minggu ke-`interval`, hari dalam `weekdays`
  MONTHLY → tanggal `monthDay` tiap `interval` bulan (lewati bulan yang tidak punya tanggal itu)
  batasi endsOn; batasi horizon maksimal 1 tahun per query
```
Hasil digabung dengan baris `ActivityOccurrence` yang ada (status CANCELLED / override).

### Daftar kegiatan untuk grup Y pada rentang tanggal
1. Ambil `Activity` dengan `groupId ∈ ancestors(Y) ∪ {Y} ∪ descendants(Y)`.
2. Ekspansi tiap activity → daftar `(activity, date, inherited: bool, editable: bool)`.
3. Tandai konflik (lihat bawah).

### Deteksi konflik (peringatan saja)
Dua occurrence **konflik** jika tanggal sama dan jendela `[startTime, startTime+duration)` beririsan,
dan keduanya berlaku untuk minimal satu grup yang sama (yaitu salah satu milik ancestor/self/descendant yang lain).
Dihitung saat simpan kegiatan (horizon 90 hari ke depan) dan saat render daftar/kalender.

### Edit kegiatan berulang
- Edit template → berlaku ke semua occurrence yang belum punya override.
- Per-occurrence: batalkan, ganti jam, ganti lokasi, catatan (buat baris `ActivityOccurrence`).
- **Akhiri mulai tanggal X**: set `endsOn = X-1`; occurrence lampau & absensinya tetap ada. Tidak ada "ubah properti mulai tanggal ini ke depan" (workaround: akhiri lalu buat kegiatan baru).

### Absensi
- Halaman `/kegiatan/[id]/[tanggal]?grup=Y`: daftar anggota AKTIF dalam scope Y (default = grup user), checkbox HADIR / IZIN, simpan massal.
- Simpan = transaksi: upsert `ActivityOccurrence(activityId, date)` → upsert/delete `Attendance` per anggota.
- `expected` untuk occurrence dilihat dari grup Y = anggota AKTIF di Y + turunan Y.

---

## 5. Statistik (semua difilter scope + rentang tanggal, default 30 hari terakhir)

| Halaman | Isi |
|---|---|
| Anggota | Total aktif; per jenis kelamin; per status pernikahan; per status kerja; per kelompok umur; per sub-grup langsung. Hanya `status = AKTIF`. |
| Kegiatan | Per occurrence: hadir / izin / tidak hadir / expected / % hadir. Tren % hadir per tanggal. Breakdown per sub-grup langsung. |
| Partisipasi anggota | Per anggota: jumlah occurrence yang berlaku untuknya (kegiatan grupnya + ancestor, tidak CANCELLED, tanggal ≤ hari ini), hadir, izin, % hadir. Tabel bisa diurutkan. Detail di halaman anggota. |

Kelompok umur: 0–5 balita, 6–12 anak, 13–18 remaja, 19–59 dewasa, ≥60 lansia. Dihitung dari `birthDate` saat query. **Batas umur disimpan di satu konstanta (`lib/ageBrackets.ts`) agar mudah diubah nanti**; ke depan bisa dipindah ke tabel pengaturan organisasi.

---

## 6. Halaman

| Route | Fungsi |
|---|---|
| `/login` | Username + password |
| `/` | Dashboard: ringkasan statistik scope + kegiatan 7 hari ke depan |
| `/grup` | Pohon grup dalam scope |
| `/grup/[id]` | Detail: anak, anggota, kegiatan, user; tombol tambah sub-grup |
| `/anggota` | Daftar + cari nama + filter grup/status |
| `/anggota/baru`, `/anggota/[id]` | Form; detail + riwayat kehadiran |
| `/kegiatan` | Daftar per rentang tanggal (default minggu ini), badge *warisan* & *konflik* |
| `/kegiatan/baru`, `/kegiatan/[id]` | Form template; daftar occurrence |
| `/kegiatan/[id]/[tanggal]` | Absensi occurrence (+ batalkan / override) |
| `/statistik` | Tab: anggota, kegiatan, partisipasi |
| `/pengguna` | OWNER: buat user, ubah peran, reset password |
| `/pengaturan/jenjang` | OWNER root: rename level |

---

## 7. Stack & praktik

- **Next.js 15 App Router**, Server Actions untuk mutasi, Server Components untuk list.
- **Prisma 6 + PostgreSQL 16** (docker-compose lokal). `prisma db seed` membuat org, 4 level, contoh pohon, owner `admin/admin`.
- **Auth**: Auth.js v5 Credentials provider + bcrypt, JWT session berisi `{userId, groupId, role, groupPath}` agar tiap request tidak perlu query ulang scope.
- **UI**: Tailwind + shadcn/ui, react-hook-form + zod (skema zod dipakai ulang di Server Action), Recharts untuk grafik.
- **Tanggal**: simpan `@db.Date` untuk tanggal & string `HH:mm` untuk jam; satu timezone organisasi (`Asia/Jakarta`). Hindari `DateTime` dengan tz untuk jadwal berulang.
- **Validasi server-side wajib** untuk: depth grup = parent+1, anggota hanya di grup daun, scope semua mutasi.
- Setiap tabel punya `createdAt/updatedAt`; `createdById` di Member/Activity; `recordedById` di Attendance — audit minimal.

### Urutan pengerjaan (target 1 hari)
1. Scaffold Next + Prisma + Postgres + shadcn — 1 jam
2. Schema, migrasi, seed — 1 jam
3. Auth + helper `authorize` / `visibleGroupIds` — 1 jam
4. Grup: pohon + CRUD + rename level — 1.5 jam
5. Anggota: list/cari/filter + form — 1.5 jam
6. Kegiatan: form + `expandDates` + daftar rentang tanggal + konflik — 2 jam
7. Absensi — 1 jam
8. Statistik (3 tab) — 1.5 jam
9. Pengguna — 0.5 jam

---

## 8. Keputusan tambahan (sudah dikonfirmasi)

1. ADMIN boleh membuat user USER/ADMIN dalam scope; OWNER saja yang bisa membuat OWNER dan menurunkan ADMIN.
2. Sub-grup tidak bisa opt-out dari kegiatan warisan.
3. Satu timezone `Asia/Jakarta` (per-grup timezone: nanti).
4. `WorkStatus` memisahkan pelajar menjadi SD / SMP / SMA.
5. Kelompok umur dapat diubah nanti (konstanta terpusat).
6. Kegiatan berulang: edit template, batalkan per tanggal, akhiri mulai tanggal tertentu.
7. Auth.js v5 Credentials.
8. Rentang statistik default 30 hari.
9. Pindah grup ke parent lain & riwayat mutasi anggota: bukan MVP.

## 9. Non-MVP (sudah disiapkan jalurnya)

| Fitur | Persiapan di MVP |
|---|---|
| Relasi anggota (ayah, ibu, saudara, suami/istri, anak) | Tabel `MemberRelation(memberId, relatedId, type)` — tambah nanti, tidak mengubah `Member`. |
| Foto anggota | Kolom `photoUrl` + object storage; tambah nanti. |
| Multi-peran per user | Hapus `@unique` di `UserGroupRole.userId`; scope jadi union path. |
| Syarat peserta kegiatan (perempuan saja, SMP, dll.) | Kolom JSON `criteria` di `Activity`; fungsi `expected()` sudah terpusat sehingga tinggal tambah filter. |
| Multi-organisasi | `organizationId` sudah ada di Level/Group. |
