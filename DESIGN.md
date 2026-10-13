# Dahan — Desain MVP

Aplikasi manajemen anggota & kegiatan untuk organisasi berjenjang
(pusat → daerah → desa → kelompok). **Dahan** ("cabang pohon") adalah nama produk; di dalam aplikasi nama organisasi (`Organization.name`) tampil lebih dulu dengan tanda kecil "oleh Dahan". Repo, paket, database, dan identifier kode tetap `ngaji`.

Stack: **Next.js (App Router, Server Actions) + Prisma + SQLite**, UI Bahasa Indonesia, mobile-first.

Data anggota bersifat **sensitif** (PII). Keamanan dan jejak audit adalah syarat, bukan fitur tambahan — lihat §4.

---

## 1. Keputusan yang sudah disepakati

| Topik | Keputusan |
|---|---|
| Tenancy | Satu organisasi per deployment. Owner pertama dibuat lewat seed. Tabel `Organization` tetap ada agar mudah multi-tenant nanti. |
| Jenjang grup | Level tetap & berurutan, tidak boleh loncat. Nama level bisa diganti (`pusat`, `daerah`, `desa`, `kelompok`). |
| Anggota | Hanya di grup **daun** (depth = level terakhir). Keluar = ubah `status`, bukan hapus. |
| Hapus data | **Tidak ada hard delete** untuk entitas domain. Grup, anggota, kegiatan = soft delete (`deletedAt`). User = nonaktifkan (`isActive`). Absensi boleh dihapus barisnya (itu makna "tidak hadir"), tetapi tercatat di audit log. |
| Peran | `OWNER`, `ADMIN`, `USER`. Satu user = satu grup + satu peran (MVP). Semua peran boleh CRUD anggota. |
| Login | Username + password. Reset password oleh owner/admin (lihat §3.4). Tanpa email. |
| Sesi | JWT berisi `groupPath` untuk filter scope, tetapi `isActive` & `role` **divalidasi ulang ke DB tiap request**. |
| Kegiatan | Aturan berulang sederhana; baris occurrence dibuat **lazy** hanya saat absensi diisi / occurrence diubah. |
| Edit kegiatan | Hanya user (peran ≥ ADMIN) yang **tepat di grup pemilik** kegiatan. Grup di atas maupun di bawah tidak bisa mengubah. |
| Konflik | Peringatan jika jam bertabrakan; tetap boleh disimpan. Perlu `durationMinutes`. |
| Absensi | `HADIR` / `IZIN`; tidak ada baris = tidak hadir. Hanya untuk grup **daun** dan tanggal ≤ hari ini. |
| Audit | Setiap mutasi menulis `AuditLog` di transaksi yang sama. Login sukses/gagal juga dicatat. |
| Minggu | Dimulai hari **Minggu** (`0`). |

---

## 2. Model data (Prisma)

SQLite has no native `enum` type in Prisma, so the domain enums below are **not** Prisma `enum` blocks — they are plain `String` columns on the models. The value sets still live in one place, as TS union types + zod schemas in `lib/validation/*`, which is what actually enforces them (the DB no longer rejects an invalid string at the column level):

```ts
// lib/validation/enums.ts (single source of truth, reused by zod schemas)
type Role             = 'OWNER' | 'ADMIN' | 'USER'
type Sex              = 'L' | 'P'
type MaritalStatus    = 'BELUM_MENIKAH' | 'MENIKAH' | 'CERAI_HIDUP' | 'CERAI_MATI'
type WorkStatus        = 'BEKERJA' | 'TIDAK_BEKERJA' | 'PELAJAR_SD' | 'PELAJAR_SMP' | 'PELAJAR_SMA' | 'MAHASISWA' | 'IBU_RUMAH_TANGGA' | 'PENSIUN'
type MemberStatus     = 'AKTIF' | 'KELUAR' | 'PINDAH' | 'MENINGGAL'
type Freq             = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
type OccurrenceStatus = 'SCHEDULED' | 'CANCELLED'
type AttendanceStatus = 'HADIR' | 'IZIN'
type ViewSource       = 'member'      // sumber data tampilan; hanya 'member' untuk sekarang
type ViewVisibility   = 'GROUP'       // hanya 'GROUP' untuk sekarang (tampilan pribadi = non-MVP)
```

```prisma

model Organization {
  id        Int      @id @default(autoincrement())
  name      String
  timezone  String   @default("Asia/Jakarta")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  levels    Level[]
  groups    Group[]
}

/// Nama jenjang, depth 0 = root. Rename level = ubah satu baris.
model Level {
  id             Int          @id @default(autoincrement())
  organizationId Int
  depth          Int
  name           String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id])
  @@unique([organizationId, depth])
}

model Group {
  id             Int       @id @default(autoincrement())
  organizationId Int
  parentId       Int?
  depth          Int                      // harus = parent.depth + 1
  name           String                   // unik di antara saudara yang belum dihapus (cek di app)
  path           String                   // materialized path termasuk id sendiri + slash penutup: "1/5/12/"
  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  parent         Group?    @relation("tree", fields: [parentId], references: [id])
  children       Group[]   @relation("tree")
  members        Member[]
  activities     Activity[]
  userRoles      UserGroupRole[]
  memberViews    MemberView[]

  @@index([path])
  @@index([parentId])
}

model User {
  id                 Int      @id @default(autoincrement())
  username           String   @unique
  passwordHash       String
  name               String
  isActive           Boolean  @default(true)
  mustChangePassword Boolean  @default(false)   // true setelah seed & setelah reset oleh admin/owner
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  role               UserGroupRole?
  createdMembers     Member[]       @relation("memberCreatedBy")
  createdActivities  Activity[]     @relation("activityCreatedBy")
  recordedAttendance Attendance[]   @relation("attendanceRecordedBy")
  auditLogs          AuditLog[]
  ownedMemberViews   MemberView[]   @relation("memberViewOwner")
  createdMemberViews MemberView[]   @relation("memberViewCreatedBy")
}

/// MVP: @@unique([userId]). Non-MVP multi-peran = hapus unique ini saja.
model UserGroupRole {
  id        Int      @id @default(autoincrement())
  userId    Int      @unique
  groupId   Int
  role      String                       // Role (lib/validation/enums.ts)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id])
  group     Group    @relation(fields: [groupId], references: [id])
  @@index([groupId])
}

model Member {
  id            Int           @id @default(autoincrement())
  groupId       Int                          // wajib grup daun
  name          String
  birthPlace    String
  birthDate     String                       // YYYY-MM-DD
  sex           String                       // Sex (lib/validation/enums.ts)
  address       String
  phone         String                       // TIDAK unique (satu HP bisa dipakai sekeluarga)
  maritalStatus String                       // MaritalStatus
  workStatus    String                       // WorkStatus
  email         String?
  status        String        @default("AKTIF") // MemberStatus
  joinedAt      String                       // YYYY-MM-DD; tanggal bergabung, default hari ini saat input. Dipakai statistik.
  exitedAt      String?                      // YYYY-MM-DD; wajib diisi saat status != AKTIF
  deletedAt     DateTime?                    // soft delete (salah input); beda dengan status KELUAR
  createdById   Int
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  group       Group        @relation(fields: [groupId], references: [id])
  createdBy   User         @relation("memberCreatedBy", fields: [createdById], references: [id])
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
  durationMinutes Int                       // startTime + duration <= 24:00 (tidak lewat tengah malam)
  freq            String                    // Freq (lib/validation/enums.ts)
  interval        Int       @default(1)     // tiap N hari/minggu/bulan
  weekdays        Json                      // number[] (WEEKLY: 0=Minggu..6=Sabtu, minimal 1); SQLite tidak punya scalar list, disimpan sebagai JSON array
  monthDay        Int?                      // MONTHLY: tanggal 1..31
  startsOn        String                    // YYYY-MM-DD
  endsOn          String?                   // YYYY-MM-DD; null = tanpa akhir; ONCE: = startsOn; >= startsOn
  continuesFromId Int?                      // diisi jika kegiatan ini hasil "geser ini & seterusnya" (§5.5)
  createdById     Int
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  group         Group                @relation(fields: [groupId], references: [id])
  createdBy     User                 @relation("activityCreatedBy", fields: [createdById], references: [id])
  continuesFrom Activity?            @relation("split", fields: [continuesFromId], references: [id])
  continuedBy   Activity[]           @relation("split")
  occurrences   ActivityOccurrence[]

  @@index([groupId])
}

/// Dibuat lazy: hanya saat ada absensi atau override (batal / geser / ganti jam / lokasi).
/// `date` = tanggal menurut aturan (kunci). Tanggal efektif = overrideDate ?? date.
model ActivityOccurrence {
  id                      Int              @id @default(autoincrement())
  activityId              Int
  date                    String                            // YYYY-MM-DD
  status                  String           @default("SCHEDULED") // OccurrenceStatus
  overrideDate            String?                           // YYYY-MM-DD; "geser satu kali" ke tanggal lain
  overrideStartTime       String?
  overrideDurationMinutes Int?
  overrideLocation        String?
  overrideNotes           String?
  createdAt               DateTime         @default(now())
  updatedAt               DateTime         @updatedAt

  activity    Activity     @relation(fields: [activityId], references: [id])
  attendances Attendance[]

  @@unique([activityId, date])
  @@index([activityId, overrideDate])
}

model Attendance {
  id           Int              @id @default(autoincrement())
  occurrenceId Int
  memberId     Int
  status       String                       // AttendanceStatus
  recordedById Int
  recordedAt   DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  occurrence ActivityOccurrence @relation(fields: [occurrenceId], references: [id])
  member     Member             @relation(fields: [memberId], references: [id])
  recordedBy User               @relation("attendanceRecordedBy", fields: [recordedById], references: [id])

  @@unique([occurrenceId, memberId])
  @@index([memberId])
}

/// Tampilan anggota tersimpan (§12). Dimiliki satu grup; hanya terlihat oleh user di grup itu persis (bukan leluhur/turunan).
model MemberView {
  id          Int       @id @default(autoincrement())
  groupId     Int                          // grup pembuat saat dibuat; tidak pernah dari client
  ownerId     Int                          // bisa berbeda dari createdById setelah diambil alih
  createdById Int
  name        String                       // unik di antara tampilan grup yang belum dihapus, tanpa beda huruf besar/kecil (cek di app)
  source      String    @default("member") // ViewSource
  visibility  String    @default("GROUP")  // ViewVisibility
  definition  Json                         // divalidasi lib/validation/member-view.ts di setiap simpan dan muat
  deletedAt   DateTime?                    // soft delete
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  group     Group @relation(fields: [groupId], references: [id])
  owner     User  @relation("memberViewOwner", fields: [ownerId], references: [id])
  createdBy User  @relation("memberViewCreatedBy", fields: [createdById], references: [id])

  @@index([groupId, deletedAt])
}

/// Formulir survei. Dimiliki satu grup; otomatis berlaku ke semua turunannya (pewarisan seperti Activity, §3.3).
/// Tidak ada status buka/tutup: menerima jawaban selama belum dihapus (soft).
model Survey {
  id          Int       @id @default(autoincrement())
  groupId     Int
  title       String
  description String?
  createdById Int
  deletedAt   DateTime?                 // soft delete; pertanyaan, respons, dan jawaban tetap tersimpan
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  group     Group            @relation(fields: [groupId], references: [id])
  createdBy User             @relation("surveyCreatedBy", fields: [createdById], references: [id])
  questions SurveyQuestion[]
  responses SurveyResponse[]

  @@index([groupId])
}

/// Terkunci setelah dijawab (tipe, rentang skala, hapus permanen): kunci diturunkan dari baris SurveyAnswer, tidak disimpan.
model SurveyQuestion {
  id         Int       @id @default(autoincrement())
  surveyId   Int
  order      Int
  type       String                     // QuestionType (lib/validation/enums.ts)
  label      String
  helpText   String?
  required   Boolean   @default(false)
  scaleMin   Int?                       // hanya SCALE
  scaleMax   Int?                       // hanya SCALE; scaleMin < scaleMax, maksimal 11 langkah
  archivedAt DateTime?                  // disembunyikan dari form isi, tetap tampil di hasil
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  survey  Survey         @relation(fields: [surveyId], references: [id])
  options SurveyOption[]
  answers SurveyAnswer[]

  @@index([surveyId, order])
}

/// Opsi pilihan dengan id stabil: ganti label = melabeli ulang jawaban lama, arsip = hitungan tetap.
model SurveyOption {
  id         Int       @id @default(autoincrement())
  questionId Int
  order      Int
  label      String
  archivedAt DateTime?

  question SurveyQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  answers  SurveyAnswer[]

  @@index([questionId, order])
}

/// Paling banyak satu per anggota per survei; menyimpan lagi = menimpa. Dihapus permanen (seperti Attendance), tercatat di audit.
model SurveyResponse {
  id           Int      @id @default(autoincrement())
  surveyId     Int
  memberId     Int
  recordedById Int                      // penyimpan terakhir
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  survey     Survey         @relation(fields: [surveyId], references: [id])
  member     Member         @relation(fields: [memberId], references: [id])
  recordedBy User           @relation("surveyResponseRecordedBy", fields: [recordedById], references: [id])
  answers    SurveyAnswer[]

  @@unique([surveyId, memberId])
  @@index([memberId])
}

/// Satu baris per pertanyaan terjawab; MULTI_CHOICE satu baris per opsi terpilih.
/// Tepat satu dari optionId / numberValue / textValue terisi, sesuai tipe pertanyaan.
model SurveyAnswer {
  id          Int     @id @default(autoincrement())
  responseId  Int
  questionId  Int
  optionId    Int?
  numberValue Float?
  textValue   String?

  response SurveyResponse @relation(fields: [responseId], references: [id], onDelete: Cascade)
  question SurveyQuestion @relation(fields: [questionId], references: [id])
  option   SurveyOption?  @relation(fields: [optionId], references: [id])

  @@index([responseId])
  @@index([questionId, optionId])
}

/// Jejak audit. Ditulis di transaksi yang sama dengan mutasinya. Append-only (tidak ada update/delete).
model AuditLog {
  id        Int      @id @default(autoincrement())
  actorId   Int?                 // null untuk login gagal dengan username tak dikenal
  action    String               // "member.create", "attendance.save", "auth.login_failed", ...
  entity    String?              // "Member", "Activity", ...
  entityId  Int?
  groupId   Int?                 // grup terkait; dipakai untuk filter scope saat melihat log
  before    Json?                // snapshot sebelum (field sensitif diredaksi, lihat §4.4)
  after     Json?                // snapshot sesudah
  meta      Json?                // mis. { username } pada login gagal, { memberIds } pada absensi
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())

  actor User? @relation(fields: [actorId], references: [id])

  @@index([entity, entityId])
  @@index([actorId, createdAt])
  @@index([groupId, createdAt])
  @@index([action, createdAt])
}
```

### Catatan model
- **Materialized path** (`path`) dipilih daripada recursive CTE agar query turunan cukup `startsWith` di Prisma. `path` memuat id grup itu sendiri dan diakhiri `/` agar `"1/5/"` tidak cocok dengan `"1/50/"`. Membuat grup = insert lalu update `path` dalam satu transaksi. Pindah grup ke parent lain = tulis ulang path subtree — **tidak ada di MVP**.
- **Soft delete di mana-mana.** Setiap query `Group`, `Member`, `Activity` **wajib** menambahkan `deletedAt: null`. Buat helper/extension Prisma agar tidak lupa. Hapus grup hanya jika tidak punya anak, anggota, kegiatan, dan user (yang belum dihapus).
- `Member.deletedAt` ≠ `status = KELUAR`. Hapus = salah input; keluar = peristiwa nyata yang masuk statistik.
- `PINDAH` tanpa riwayat mutasi: anggota yang pindah grup dibuat ulang sebagai baris baru di grup tujuan (identitas terpisah). Ini disengaja untuk MVP (§9.9); jangan "diperbaiki" tanpa desain riwayat.
- Absen = anggota yang *expected* (§6) di scope occurrence yang **tidak punya** baris Attendance.
- `createdById` / `recordedById` punya relasi ke `User` (FK), bukan integer lepas.
- Semua **tanggal** — di kode aplikasi maupun kolom Prisma — berbentuk string `YYYY-MM-DD` (SQLite tidak punya tipe DATE native, jadi kolom tanggal didefinisikan `String`, bukan `DateTime`). Tidak ada konversi Date↔string di perbatasan Prisma untuk tanggal murni; `lib/dates.ts` hanya berisi util kalkulasi (tambah hari, cari Minggu terdekat, dst.) yang beroperasi langsung di atas string `YYYY-MM-DD` dan `Intl`/`Date` sesekali secara internal untuk itu. Perbandingan/urutan tanggal tetap valid karena string ISO `YYYY-MM-DD` terurut secara leksikografis sama dengan urutan kronologisnya. Kolom non-tanggal (`createdAt`, `updatedAt`, `recordedAt`) tetap `DateTime` biasa.
- `weekdays` pada `Activity` disimpan sebagai kolom `Json` (array angka), karena SQLite tidak mendukung scalar list (`Int[]`) di Prisma. Validasi bentuk & isi array tetap di zod (`lib/validation/activity.ts`).
- **Survei** (§11): `Survey` soft delete (`deletedAt: null` wajib di setiap query, seperti `Activity`). `SurveyResponse`/`SurveyAnswer` dihapus permanen (seperti `Attendance`), isi yang dihapus ada di audit. Jawaban adalah PII anggota: hanya terbaca lewat query yang terfilter scope dan viewer audit OWNER.
- **Tampilan anggota** (§12): `MemberView` soft delete (`deletedAt: null` wajib di setiap query). `definition` adalah `Json` (aturan, urutan, pengelompokan, kolom) dan tidak pernah dipercaya mentah: selalu di-parse zod (ketat saat simpan, longgar saat muat).
- Enum domain (`Role`, `Sex`, `MaritalStatus`, `WorkStatus`, `MemberStatus`, `Freq`, `OccurrenceStatus`, `AttendanceStatus`, `QuestionType`, `ViewSource`, `ViewVisibility`) bukan Prisma `enum` (tidak didukung SQLite) — kolomnya `String`, nilai valid ditegakkan oleh TS union + zod di `lib/validation/enums.ts`, bukan oleh database.

---

## 3. Aturan akses

### 3.1 Scope
Setiap user punya satu `UserGroupRole (groupId, role)`. **Scope** = grup itu + semua turunannya
(`group.path startsWith scopeGroup.path`). Semua query list wajib difilter scope di server.

**Setiap ID yang datang dari client** (`groupId`, `memberId`, `activityId`, `occurrenceId`, `userId`, `surveyId`, `questionId`, `optionId`, tanggal absensi) **wajib di-resolve ke entitasnya di server lalu dicek terhadap scope dan aturan di bawah**. `authorize` menerima entitas hasil resolve, bukan ID mentah.

### 3.2 Matriks izin

| Aksi | OWNER | ADMIN | USER |
|---|:-:|:-:|:-:|
| Lihat grup, anggota, kegiatan, statistik dalam scope | ✅ | ✅ | ✅ |
| Buat / ubah / hapus (soft) anggota dalam scope | ✅ | ✅ | ✅ |
| Isi absensi (syarat §3.3) | ✅ | ✅ | ✅ |
| Ganti password sendiri | ✅ | ✅ | ✅ |
| Buat / rename / hapus (soft) sub-grup dalam scope | ✅ | ✅ | ❌ |
| Buat / ubah / hapus (soft) kegiatan **milik grup user sendiri** | ✅ | ✅ | ❌ |
| Batalkan / geser occurrence kegiatan **milik grup user sendiri** | ✅ | ✅ | ❌ |
| Lihat survei & hasilnya (§11): leluhur / grup user / dalam scope; data dibatasi scope | ✅ | ✅ | ✅ |
| Buat / ubah / hapus (soft) survei **milik grup user sendiri** | ✅ | ✅ | ❌ |
| Isi / ubah / hapus respons survei untuk anggota aktif di grup daun dalam scope (user di grup pemilik survei atau di bawahnya) | ✅ | ✅ | ✅ |
| Lihat tampilan anggota (§12) **milik grup user sendiri** (persis, bukan leluhur/turunan) | ✅ | ✅ | ✅ |
| Buat tampilan anggota di grup user sendiri; "Simpan sebagai baru" | ✅ | ✅ | ✅ |
| Ubah / hapus (soft) tampilan anggota — hanya **pemiliknya** | ✅ | ✅ | ✅ |
| Ambil alih tampilan yatim (pemilik nonaktif / pindah grup) di grup user sendiri | ✅ | ✅ | ❌ |
| Buat user USER / ADMIN untuk grup dalam scope | ✅ | ✅ | ❌ |
| Reset password user lain | ✅ semua dalam scope | ✅ hanya USER **di grup yang sama** | ❌ |
| Buat user OWNER (grup dalam scope) | ✅ | ❌ | ❌ |
| Ubah peran user (USER ↔ ADMIN ↔ OWNER) dalam scope | ✅ | ❌ | ❌ |
| Pindahkan user ke grup lain dalam scope | ✅ | ❌ | ❌ |
| Nonaktifkan / aktifkan user dalam scope | ✅ | ❌ | ❌ |
| Lihat audit log dalam scope | ✅ | ❌ | ❌ |
| Ganti nama jenjang (Level) | ✅ hanya jika grupnya depth 0 | ❌ | ❌ |

Aturan tambahan untuk manajemen user:
- ADMIN tidak pernah boleh mengubah/mereset user berperan OWNER atau ADMIN, meski dalam scope.
- User tidak boleh menonaktifkan atau menurunkan peran dirinya sendiri.
- Tidak boleh menonaktifkan / menurunkan **OWNER aktif terakhir di grup root** (cegah terkunci).
- Setelah reset password oleh orang lain, `mustChangePassword = true`; user dipaksa ke `/dashboard/akun/password` sebelum halaman lain.

### 3.3 Kegiatan warisan
Misal kegiatan A milik grup X, user U di grup G, absensi diisi untuk grup daun Y.

- **Berlaku**: A berlaku untuk X dan semua turunan X.
- **Terlihat** (`canViewActivity`): `X ∈ ancestors(G) ∪ scope(U)`. Grup di jalur atas terlihat karena diwarisi; grup dalam scope terlihat karena scope. Kegiatan cabang lain (bukan leluhur, bukan turunan) → 404.
- **Absensi** (`canRecordAttendance`): semua syarat berikut:
  1. `X ∈ ancestors(G) ∪ {G}` — A berlaku untuk grup user (user berada **di X atau di bawah X**).
  2. `Y ∈ scope(U)` dan Y adalah grup **daun**.
  3. A berlaku untuk Y (`X ∈ ancestors(Y) ∪ {Y}`).
  4. Tanggal adalah occurrence sah A (§5.2) dan ≤ hari ini (Asia/Jakarta).
  5. Setiap `memberId` yang dikirim ada di subtree Y, belum dihapus, dan *expected* pada tanggal itu (§6).
  Konsekuensi: user di **atas** X (mis. admin daerah untuk kegiatan milik kelompok) bisa melihat, tetapi tidak bisa mengisi absensi.
- **Ubah** (`canEditActivity`): `G === X` dan peran ≥ ADMIN. Berlaku untuk ubah template, hapus, batal/geser occurrence, dan "geser ini & seterusnya". OWNER root pun **tidak** bisa mengubah kegiatan milik kelompok — ia harus punya akun di grup itu, atau meminta admin grup tersebut.
- Tidak ada opt-out: sub-grup tidak bisa menonaktifkan kegiatan warisan (MVP).

### 3.4 Reset password
- OWNER: boleh mereset password user mana pun yang grupnya dalam scope (termasuk OWNER lain dan grup anak).
- ADMIN: hanya user berperan `USER` yang `groupId` **sama persis** dengan grup admin.
- Reset = set password sementara yang dibuat server (bukan pilihan admin) + `mustChangePassword = true` + audit `user.reset_password`.

### 3.5 Helper `authorize`

```ts
// lib/authz.ts
type Action =
  | 'group.view' | 'group.create' | 'group.update' | 'group.delete'
  | 'member.view' | 'member.create' | 'member.update' | 'member.delete'
  | 'activity.view' | 'activity.create' | 'activity.update' | 'activity.delete' | 'activity.split'
  | 'occurrence.override'          // batalkan / geser satu / ganti jam-lokasi
  | 'attendance.record'
  | 'survey.view' | 'survey.create' | 'survey.update' | 'survey.delete'
  | 'survey_response.record' | 'survey_response.delete'
  | 'member_view.view' | 'member_view.create' | 'member_view.update' | 'member_view.delete' | 'member_view.transfer'
  | 'stats.view'
  | 'user.view' | 'user.create' | 'user.updateRole' | 'user.move'
  | 'user.setActive' | 'user.resetPassword'
  | 'level.rename'
  | 'audit.view';

// target = entitas hasil resolve (punya group.path), bukan ID mentah.
// Melempar ForbiddenError (→ 403) atau NotFoundError (→ 404 untuk entitas di luar scope).
function authorize(session: Session, action: Action, target: Target): void
function visibleGroupsWhere(session: Session): Prisma.GroupWhereInput   // { path: { startsWith }, deletedAt: null }
```

| Action | Syarat (selain autentikasi & `isActive`) |
|---|---|
| `*.view`, `stats.view` | target.group dalam scope (kecuali `activity.view`, lihat §3.3) |
| `member.*` | target.group dalam scope; `create`: grup daun |
| `group.create/update/delete` | peran ≥ ADMIN; parent/target dalam scope; `delete`: kosong |
| `activity.create` | peran ≥ ADMIN; `groupId === session.groupId` |
| `activity.update/delete/split`, `occurrence.override` | peran ≥ ADMIN; `activity.groupId === session.groupId` |
| `attendance.record` | §3.3 |
| `survey.view` | target `{ surveyGroupPath }`: sama dengan `activity.view` (leluhur/grup user atau dalam scope; selain itu 404) |
| `survey.create` | peran ≥ ADMIN; `groupId === session.groupId` |
| `survey.update/delete` | peran ≥ ADMIN; `survey.groupId === session.groupId` |
| `survey_response.record/delete` | target `{ surveyGroupPath, memberGroupPath, memberIsLeaf }`: user di grup pemilik survei atau di bawahnya; grup anggota daun dalam scope (di luar scope → 404, di atas pemilik → 403). `record` juga mensyaratkan anggota `AKTIF` — aturan data, dicek di action, bukan di `authorize` |
| `member_view.view` | target `{ groupId, ownerId, ownerIsActive, ownerGroupId }`: `view.groupId === session.groupId` persis, selain itu 404 (leluhur dan turunan juga 404) |
| `member_view.create` | `groupId === session.groupId`; semua peran |
| `member_view.update/delete` | seperti `view`, lalu `ownerId === session.user.id` (selain itu 403, ADMIN pun) |
| `member_view.transfer` | seperti `view`, peran ≥ ADMIN, dan tampilan yatim (`!ownerIsActive` atau `ownerGroupId !== view.groupId`); selain itu 403 |
| `user.create` | peran ≥ ADMIN; grup target dalam scope; peran baru OWNER hanya oleh OWNER |
| `user.resetPassword` | §3.4 |
| `user.updateRole/move/setActive` | OWNER; target dalam scope; bukan diri sendiri; bukan OWNER root terakhir |
| `level.rename` | OWNER dengan grup depth 0 |
| `audit.view` | OWNER; filter `groupId` dalam scope |

Setiap Server Action: `auth()` → zod parse → resolve target → `authorize` → transaksi (mutasi + `audit()`).

---

## 4. Keamanan & audit

### 4.1 Autentikasi & sesi
- Auth.js v5 Credentials + **bcrypt cost 12**. Password minimal 8 karakter (zod). Pesan gagal login generik ("username atau password salah").
- **Rate limit login**: tolak jika ≥ 5 gagal untuk username yang sama atau ≥ 20 gagal dari IP yang sama dalam 15 menit. Dihitung dari `AuditLog` (`auth.login_failed`), tidak perlu store terpisah.
- JWT berisi `{ userId, groupId, role, groupPath }`. Di callback `jwt` (dipanggil tiap `auth()`), **query ulang `User` + `UserGroupRole`**: jika `isActive = false` → sesi dibatalkan; jika `role`/`groupId` berubah → token diperbarui. Satu query PK per request; ini disengaja agar nonaktifkan/turunkan peran langsung berlaku.
- Cookie sesi: `httpOnly`, `secure` (production), `sameSite=lax`, `maxAge` 7 hari.
- Seed owner `admin/admin` dibuat dengan `mustChangePassword = true`.
- `mustChangePassword = true` → middleware mengarahkan semua route (kecuali `/dashboard/akun/password`, `/login`) ke halaman ganti password.
- **Route publik** (tanpa sesi): hanya `/`, `/ormas`, `/login`, dicocokkan **persis** oleh `isPublicPath` di `lib/auth/public-paths.ts` (tanpa prefix: `/ormas/1`, `/Login`, `/ormas/` bukan publik). Route lain (termasuk semua `/dashboard/**`) tanpa sesi → redirect `/login`; dengan sesi, `/` dan `/login` → redirect `/dashboard`. Halaman publik tidak membaca data dari DB, tidak memuat skrip/tracker pihak ketiga, dan CSP (§4.3) tidak berubah.

### 4.2 Otorisasi
- Semua di §3. Tidak ada endpoint yang memakai `groupId`/`groupPath` dari client tanpa resolve + cek.
- Entitas di luar scope dijawab **404** (bukan 403) agar tidak membocorkan keberadaan data.

### 4.3 Transport & header
- HTTPS saja (HSTS `max-age=31536000; includeSubDomains`).
- Header via `next.config.ts`: `Content-Security-Policy` (`default-src 'self'`; `script-src 'self' 'nonce-…'`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data:`; `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal.
- Server Actions: origin check bawaan Next; tidak ada API route publik di MVP.

### 4.4 Data & log
- Log aplikasi (stdout) **tidak** memuat PII, password, atau token — hanya id.
- `AuditLog.before/after` boleh memuat data anggota (itulah gunanya), tetapi **selalu meredaksi** `passwordHash` dan field yang berawalan `password`. Hanya OWNER yang bisa membaca audit log, dan hanya untuk `groupId` dalam scope.
- Error ke pengguna generik; stack trace hanya di log server.
- `pnpm audit` di CI, `pnpm install --frozen-lockfile`, tidak ada script postinstall tanpa review.
- Backup DB & enkripsi at-rest adalah tanggung jawab deployment (di luar MVP kode), tetapi wajib dicatat di runbook.

### 4.5 Audit log — apa yang dicatat
Helper `audit(tx, { action, entity, entityId, groupId, before, after, meta })` dipanggil **di dalam transaksi Prisma yang sama** dengan mutasinya. Jika audit gagal, mutasi ikut batal.

| Action | Kapan | before/after |
|---|---|---|
| `auth.login`, `auth.login_failed`, `auth.logout` | login/logout | `meta: { username }` |
| `user.create`, `user.update_role`, `user.move`, `user.set_active`, `user.reset_password`, `user.change_password` | manajemen user | snapshot tanpa hash |
| `group.create/update/delete`, `level.rename` | struktur | snapshot |
| `member.create/update/delete` | anggota | snapshot penuh (PII) |
| `activity.create/update/delete/split` | template kegiatan | snapshot; `split` mencatat `{ fromActivityId, toActivityId, fromDate }` |
| `occurrence.override` | batal/geser/jam/lokasi | snapshot baris occurrence |
| `attendance.save` | simpan massal absensi | `meta: { date, groupId, set: [{memberId,status}], removed: [memberId] }` |
| `survey.create/update/delete` | formulir survei | snapshot survei + pertanyaan + opsi; `groupId` = grup pemilik; ubah formulir = satu `survey.update` per simpan |
| `survey_response.save` | simpan/timpa respons | `before` = jawaban lama (null jika baru), `after` = jawaban baru; `groupId` = grup anggota; `meta: { surveyId, memberId }` |
| `survey_response.delete` | hapus respons | `before` = jawaban yang dihapus; `groupId` = grup anggota; `meta: { surveyId, memberId }` |
| `member_view.create` | simpan tampilan baru | `after` = nama, source, visibility, definisi; `groupId` = grup pemilik |
| `member_view.update` | simpan / ubah nama | `before`/`after` = nama + definisi |
| `member_view.delete` | hapus (soft) | `before` = snapshot tampilan |
| `member_view.transfer` | ambil alih | `meta: { fromOwnerId, toOwnerId }` |

Membuka/mendaftar tampilan dan draf yang belum disimpan (`?d=`) tidak diaudit.

Halaman `/dashboard/audit` (OWNER): terbaru dulu, filter grup (multi, termasuk turunan; memilih grup menyembunyikan entri `auth.*` tanpa grup) / rentang tanggal (default semua waktu) / aksi / aktor, paginasi (§7.1).

---

## 5. Logika kegiatan

### 5.1 Ekspansi occurrence (fungsi murni, di-unit-test)
Semua tanggal = string `YYYY-MM-DD`; tidak menyentuh `Date` JS di dalam fungsi.

```
expandDates(activity, from, to): string[]
  syarat umum: startsOn ≤ d, d ≤ endsOn (jika ada), from ≤ d ≤ to, (to - from) ≤ 366 hari
  ONCE    → [startsOn]
  DAILY   → d = startsOn + k·interval hari, k ≥ 0
  WEEKLY  → minggu dimulai hari Minggu. Minggu ke-0 = minggu yang memuat startsOn.
            d masuk jika weekday(d) ∈ weekdays dan
            weeksBetween(sundayOf(startsOn), sundayOf(d)) mod interval == 0
  MONTHLY → bulan ke-0 = bulan startsOn. d = tanggal `monthDay` pada bulan ke-(k·interval);
            lewati bulan yang tidak punya tanggal itu (31 Feb, 30 Feb, ...)
```

Validasi zod (`lib/validation/activity.ts`), dipakai form & Server Action:
- `startMinutes(startTime) + durationMinutes ≤ 1440` (tidak lewat tengah malam).
- `ONCE` ⇒ `endsOn = startsOn`, `interval = 1`.
- `WEEKLY` ⇒ `weekdays.length ≥ 1`, unik, tiap nilai 0..6.
- `MONTHLY` ⇒ `monthDay` 1..31.
- `endsOn ≥ startsOn` jika diisi. `interval ≥ 1`.

### 5.2 Menggabungkan dengan baris `ActivityOccurrence`
```
occurrencesFor(activity, from, to):
  ruleDates = expandDates(activity, from, to)
  rows      = ActivityOccurrence where activityId
              and (date in [from,to] or overrideDate in [from,to])
  keys      = ruleDates ∪ { row.date | row punya ≥ 1 Attendance }   // union: riwayat absensi tidak pernah hilang
  untuk tiap key:
    row = rows[key]
    effectiveDate     = row?.overrideDate ?? key
    effectiveStart    = row?.overrideStartTime ?? activity.startTime
    effectiveDuration = row?.overrideDurationMinutes ?? activity.durationMinutes
    status            = row?.status ?? SCHEDULED
  buang yang effectiveDate ∉ [from,to]
```
Baris occurrence yang tanggalnya tidak lagi dihasilkan aturan **dan** tidak punya absensi diabaikan (yatim, tidak berbahaya).
Tanggal absensi yang dikirim client **sah** hanya jika ada di `keys` untuk `[date,date]`.

### 5.3 Daftar kegiatan untuk grup Y pada rentang tanggal
1. Ambil `Activity` (belum dihapus) dengan `groupId ∈ ancestors(Y) ∪ {Y} ∪ descendants(Y)`.
2. `occurrencesFor` tiap activity → `(activity, key, effectiveDate, inherited, canEdit, canRecord)`.
3. Tandai konflik (5.4).

Untuk satu atau lebih grup terpilih `{Y1, …, Yn}` (mis. `/dashboard/kegiatan?grup=...`): jalankan langkah 1–2 di atas per `Yi` (masing-masing di-resolve & scope-check sendiri; `Yi` di luar scope pemanggil di-drop dari union, bukan menggagalkan seluruh request), gabungkan hasilnya, dedup per occurrence (`activityId` + tanggal kunci) — jika sebuah occurrence muncul lewat lebih dari satu `Yi`, `inherited`-nya `false` bila ia bukan-warisan (milik salah satu `Yi` sendiri/descendant-nya) untuk *setidaknya satu* `Yi` — baru jalankan deteksi konflik (5.4) sekali atas kumpulan gabungan tsb, supaya konflik lintas-grup-terpilih tetap terdeteksi. Kasus `n = 1` berperilaku identik dengan sebelumnya, termasuk default ke grup pemanggil bila tidak ada grup dipilih.

### 5.4 Deteksi konflik (peringatan saja)
Dua occurrence **konflik** jika `effectiveDate` sama, jendela `[effectiveStart, effectiveStart+effectiveDuration)` beririsan, keduanya `SCHEDULED`, dan keduanya berlaku untuk minimal satu grup yang sama (salah satu milik ancestor/self/descendant yang lain).
Dihitung saat simpan kegiatan / override (horizon 90 hari ke depan) dan saat render daftar/kalender.

### 5.5 Mengubah kegiatan berulang
| Operasi | Efek | Siapa |
|---|---|---|
| **Edit template** | Semua occurrence yang belum punya override ikut berubah. Baris dengan absensi tetap tampil (union 5.2). | `activity.update` |
| **Batalkan satu tanggal** | Upsert row `status = CANCELLED`. Absensi yang sudah ada **tidak dihapus**, tetapi halaman absensi menjadi read-only dan occurrence keluar dari statistik. | `occurrence.override` |
| **Ganti jam / durasi / lokasi / catatan satu tanggal** | Upsert row override. | `occurrence.override` |
| **Geser satu kali** (ke tanggal lain) | Upsert row untuk tanggal kunci X dengan `overrideDate = Y` (+ jam/durasi baru opsional). Absensi tetap menempel pada row (kunci X). URL tetap `/dashboard/kegiatan/[id]/X`; UI menampilkan "dipindah dari X ke Y". Ditolak jika Y sudah menjadi occurrence lain dari kegiatan yang sama. | `occurrence.override` |
| **Geser ini & seterusnya** (= ubah properti mulai tanggal X ke depan) | Satu transaksi: (1) jika `X ≤ startsOn` → cukup edit template; selain itu (2) `original.endsOn = X − 1`, (3) buat `Activity` baru: salinan template + perubahan dari form, `startsOn = tanggal baru`, `continuesFromId = original.id`, (4) pindahkan `ActivityOccurrence` dengan `date ≥ X` (dan absensinya) ke activity baru. Hanya untuk `freq ≠ ONCE`. Audit `activity.split`. | `activity.split` |
| **Akhiri mulai tanggal X** | `endsOn = X − 1`; jika `X ≤ startsOn` → soft delete. | `activity.update` |
| **Hapus** | Soft delete; occurrence & absensi tetap tersimpan, tidak tampil. | `activity.delete` |

Baris `ActivityOccurrence` hanya bisa dibuat untuk tanggal kunci yang sah menurut 5.2.

### 5.6 Absensi
- Halaman `/dashboard/kegiatan/[id]/[tanggal]?grup=Y`. `Y` **wajib grup daun**. Default: grup user jika daun; jika tidak, dropdown daun-daun dalam scope yang kegiatan ini berlaku padanya.
- Daftar = anggota *expected* pada tanggal itu di Y (§6), checkbox HADIR / IZIN, simpan massal. `[tanggal]` adalah tanggal kunci (bukan `overrideDate`).
- Simpan = transaksi: cek §3.3 → upsert `ActivityOccurrence(activityId, date)` → upsert/delete `Attendance` per anggota → `audit('attendance.save')`.
- Occurrence `CANCELLED` atau tanggal > hari ini → read-only, Server Action menolak.

---

## 6. Statistik (semua difilter scope + rentang tanggal, default 30 hari terakhir)

**Expected** untuk occurrence pada `effectiveDate` D dilihat dari grup Y = anggota di subtree Y dengan
`deletedAt = null` **dan** `joinedAt ≤ D` **dan** (`status = AKTIF` **atau** `exitedAt > D`).
Fungsi `expected(occurrence, groupId)` terpusat di `lib/stats.ts` — juga dipakai halaman absensi dan (nanti) syarat peserta.

| Halaman | Isi |
|---|---|
| Anggota | Total aktif; per jenis kelamin; per status pernikahan; per status kerja; per kelompok umur; per sub-grup langsung. Hanya `status = AKTIF`, belum dihapus. |
| Kegiatan | Per occurrence (tidak CANCELLED, `effectiveDate ≤ hari ini`): hadir / izin / tidak hadir / expected / % hadir. Tren % hadir per tanggal. Breakdown per sub-grup langsung. |
| Partisipasi anggota | Per anggota: occurrence yang berlaku untuknya (kegiatan grupnya + ancestor, tidak CANCELLED) dengan `effectiveDate` di `[max(dari, joinedAt), min(sampai, exitedAt ?? hari ini)]`; hadir, izin, % hadir. Tabel bisa diurutkan. Detail di halaman anggota. |

Kelompok umur: 0–5 balita, 6–12 anak, 13–18 remaja, 19–59 dewasa, ≥60 lansia. Dihitung dari `birthDate` saat query. Batas umur di `lib/constants.ts` (`AGE_BRACKETS`), bersama `DEFAULT_STATS_RANGE_DAYS = 30`, `CONFLICT_HORIZON_DAYS = 90`, `PAGE_SIZE = 50`, `EMBEDDED_PAGE_SIZE = 10`, dan preset rentang tanggal per halaman (`*_DATE_RANGE`).

Rentang default "30 hari terakhir" = 30 hari inklusif (today−29 .. today). Statistik dihitung untuk **satu** grup scope (default grup user) karena breakdown-nya per sub-grup langsung; filter grup di `/dashboard/statistik` karena itu single-select.

---

## 7. Halaman

Semua halaman aplikasi (wajib login) ada di bawah `/dashboard` dan memakai app shell (`app/dashboard/layout.tsx`); halaman publik (`/`, `/login`, studi kasus) di luar `/dashboard` tanpa shell. User yang sudah login dan membuka `/` atau `/login` diarahkan ke `/dashboard`.

| Route | Fungsi |
|---|---|
| `/login` | Username + password |
| `/` | Landing page publik generik Dahan (tanpa data organisasi); CTA "Hubungi via WhatsApp" dari env `DAHAN_WHATSAPP` (disembunyikan bila kosong/tidak valid) |
| `/ormas` | Studi kasus publik untuk segmen ormas (anggota, pengurus, pusat/wilayah/daerah/cabang); CTA sama |
| `/dashboard/akun/password` | Ganti password sendiri (wajib jika `mustChangePassword`) |
| `/dashboard` | Dashboard: ringkasan statistik scope + kegiatan 7 hari ke depan |
| `/dashboard/grup` | Pohon grup dalam scope |
| `/dashboard/grup/[id]` | Detail (§7.2), tab: anggota (grup daun) **atau** sub-grup, kegiatan, pengguna, pengaturan (ADMIN/OWNER: rename + zona berbahaya hapus) — tiap daftar dipaginasi sendiri (`?subgrup=`, `?anggota=`, `?kegiatan=`, `?pengguna=`, 10/hal); aksi: lihat semua anggota, tambah anggota (daun, `/dashboard/anggota/baru?grup=`) atau tambah sub-grup (dialog) |
| `/dashboard/anggota` | Tabel (paginasi `?page=`, 50/hal) + cari nama + filter grup (multi, termasuk turunan) / status; kolom bisa dipilih (§7.1); tombol WhatsApp per anggota |
| `/dashboard/anggota/baru`, `/dashboard/anggota/[id]` | Form (`?grup=` memilih grup awal); detail (§7.2) tab profil, kehadiran (paginasi `?riwayat=`, 10/hal, tautan ke occurrence), ubah (form + zona berbahaya hapus soft); tombol WhatsApp |
| `/dashboard/kegiatan` | Daftar **atau** kalender (toggle) per rentang tanggal — preset Hari ini/Minggu ini/Bulan ini/pilih tanggal (default Minggu ini) dengan tombol ‹ › per rentang, badge *warisan*, *konflik*, *dipindah*, *batal*; cari nama kegiatan (badge konflik tetap dihitung dari semua kegiatan); filter grup multi-select (dengan pintasan "pilih dengan turunannya") atas union §5.3; daftar dipaginasi 50/hal; semua state (grup, rentang, tampilan, cari) di URL |
| `/dashboard/kegiatan/baru`, `/dashboard/kegiatan/[id]` | Form template; detail (§7.2) tab absensi per rentang (preset 7/30/90 hari, bulan ini, pilih tanggal; default 30 hari) dengan tabel per-occurrence & per-anggota (10/hal), jadwal 90 hari ke depan (`?jadwal=`, 10/hal; ubah satu tanggal lewat dialog, hanya `canEdit`), pengaturan (hanya `canEdit`: form, geser, zona berbahaya akhiri/hapus); aksi "Isi absensi hari ini" bila ada occurrence hari ini |
| `/dashboard/kegiatan/[id]/[tanggal]` | Absensi occurrence (+ batalkan / override / geser satu kali) — **tidak** dipaginasi (semua anggota perlu terlihat saat mengisi; ada pencarian) |
| `/dashboard/survei` | Daftar survei yang terlihat (milik leluhur atau grup dalam scope): judul, grup pemilik, jumlah respons, badge *warisan*; cari judul + filter grup (survei yang berlaku untuk grup terpilih); `PAGE_SIZE`; "Buat survei" hanya ADMIN+ (§11) |
| `/dashboard/survei/baru`, `/dashboard/survei/[id]` | Pembuat formulir; detail (§7.2) tab `?tab=hasil` (default) / `responden` / `formulir` — hasil: satu grup (`?grup=`) + filter demografi (`jk`, `umur`, `kerja`, `nikah`), tingkat respons, "Belum mengisi", grafik per pertanyaan, rincian per sub-grup; responden: daftar respons dalam scope (cari, filter grup, hapus); formulir: hanya pemilik yang bisa mengubah, lainnya baca saja; teks panjang dipaginasi lewat `?teks=<idPertanyaan>:<halaman>` |
| `/dashboard/survei/[id]/isi` | Isi / ubah jawaban satu anggota (autocomplete nama, `?anggota=` untuk prefill, "Simpan & anggota berikutnya"); hanya yang boleh mengisi, mobile-first |
| `/dashboard/tampilan` | Daftar tampilan anggota milik grup user (nama, pemilik, terakhir diperbarui); cari nama, `PAGE_SIZE`, "Buat tampilan"; semua user (§12) |
| `/dashboard/tampilan/baru`, `/dashboard/tampilan/[id]` | Hasil tampilan: bilah filter (aturan sebagai chip, sheet di HP), menu "Tampilan" (kelompokkan, urutkan, kolom), perubahan belum disimpan di `?d=`; header: Simpan / Batalkan (pemilik), Simpan sebagai baru, Ubah nama (pemilik), Ambil alih (ADMIN+, yatim); zona berbahaya hapus (pemilik) |
| `/dashboard/statistik` | Tab: anggota, kegiatan, partisipasi; filter satu grup + rentang tanggal (tidak di tab anggota); tab partisipasi bisa cari nama dan dipaginasi 50/hal |
| `/dashboard/pengguna` | OWNER & ADMIN: buat user (dialog "Tambah pengguna"); OWNER: ubah peran, pindah grup, nonaktifkan; reset password sesuai §3.4; cari nama/username + filter grup (multi, termasuk turunan); paginasi 50/hal; kontrol per user di dialog "Kelola", hanya tampil bila ada aksi yang diizinkan |
| `/dashboard/pengaturan/jenjang` | OWNER root: rename level |
| `/dashboard/audit` | OWNER: audit log dalam scope (§4.5) |

### 7.1 Konvensi tampilan daftar

- **Tata letak**: bingkai aplikasi setinggi layar; hanya area konten yang scroll. Sidebar desktop bisa diperkecil jadi ikon (tombol atau Ctrl/⌘+B; disimpan di cookie `sidebar_collapsed`). Di HP menu berupa drawer di atas konten.
- **Filter standar** (`components/filters/*`, parsing di `lib/filters.ts`): cari nama (`q`), grup (`grup`, id dipisah koma), rentang tanggal (`range` = preset atau `custom`, `anchor`, `from`, `to`). Hanya halaman dengan tanggal yang alami yang punya filter tanggal (kegiatan, statistik, detail kegiatan, audit); anggota/pengguna/grup tidak. Field kosong tidak masuk URL; mengubah filter selalu kembali ke halaman 1. Setiap id grup dari URL di-resolve & dicek scope di server (`resolveGroups`, di luar scope → 404), kecuali `/dashboard/kegiatan` yang tetap membuang id di luar scope (§5.3).
- **Arti filter grup**: di anggota, pengguna, audit = grup terpilih **beserta turunannya**; di kegiatan = kegiatan yang **berlaku untuk** grup terpilih (§5.3); di statistik = satu grup scope.
- **Paginasi** (`lib/pagination.ts`, `components/pagination.tsx`): setiap daftar yang mungkin dipaginasi; halaman di luar jangkauan dijepit ke halaman terakhir. Daftar penuh `PAGE_SIZE`, daftar di dalam halaman detail `EMBEDDED_PAGE_SIZE` dengan parameter sendiri dan tanpa lompat ke atas. Tidak dipaginasi: form absensi, pohon grup, pratinjau dashboard. Tabel yang diurutkan di klien (partisipasi, per-occurrence) dipaginasi di klien.
- **Tata letak daftar**: header halaman (§7.2) + aksi utama, kartu angka ringkas (anggota, kegiatan), lalu kartu tabel: jumlah hasil di kiri, filter di kanan, tabel, pager di bawah. Tiap baris punya menu ⋮ berisi tautan (lihat, ubah, absensi); hapus tidak ada di menu, tetap di zona berbahaya halaman detail.
- **Urutan kolom** (`lib/sort.ts`): `?sort=<kolom>&dir=asc|desc`, divalidasi terhadap daftar kolom per halaman (nilai lain → urutan default, tidak pernah diteruskan mentah ke query); urutan default tidak ditulis ke URL; mengganti urutan kembali ke halaman 1; filter mempertahankan urutan. Klik kolom aktif membalik arah, kolom lain mulai naik (waktu audit mulai turun). Selalu ada pemecah seri (nama/id) agar paginasi stabil. Kolom yang bisa diurutkan: anggota — nama + kolom opsional yang **sedang tampil** kecuali WhatsApp, No. HP, alamat, email (mengurutkan kolom tersembunyi membocorkan nilainya); pengguna — nama, username, peran, grup, status; kegiatan (daftar, diurutkan di memori) — tanggal (default), kegiatan, grup, lokasi; audit — waktu (default terbaru), aksi, aktor, entitas.
- **Kolom tabel anggota** (`lib/member/columns.ts`): Nama selalu tampil; default WhatsApp, Grup, Jenis kelamin, Tanggal lahir (+umur), Status; opsional No. HP, Tempat lahir, Alamat, Status nikah, Pekerjaan, Email, Tanggal masuk. Pilihan disimpan di cookie httpOnly `anggota_kolom` (preferensi UI, tidak diaudit) dan divalidasi ulang tiap request. Hanya kolom terpilih yang dirender di server, jadi PII kolom tersembunyi tidak dikirim ke browser.
- **WhatsApp**: link `https://wa.me/<nomor>` (tab baru). `Member.phone` teks bebas dinormalisasi (`lib/member/whatsapp.ts`): `0…`, `62…`, `+62…`, `8…` → `62…`; nomor negara lain harus diawali `+`. Nomor yang tidak valid tidak menghasilkan tombol.

### 7.2 Konvensi tata letak halaman

- **Header** (`components/page-header.tsx`): breadcrumb (akar bagian dulu, halaman sekarang terakhir tanpa tautan; di halaman grup = leluhur grup, hanya grup dalam scope yang bertautan — `lib/group/trail.ts`), judul + badge status, baris fakta ikon + teks, dan aksi di kanan (di HP di bawah judul).
- **Aksi**: aksi harian di header (sekunder `outline`, utama `default`, dengan ikon). Aksi yang tidak bisa dibatalkan (hapus, akhiri) **tidak** di header, melainkan di blok *Zona berbahaya* yang menjelaskan akibatnya; konfirmasi lewat dialog (atau `confirm()` untuk form sederhana).
- **Tab** (`components/tab-nav.tsx`, `lib/tabs.ts`): halaman dengan beberapa bagian berbeda dipisah tab di URL `?tab=` (tab default tidak ditulis); hanya tab aktif yang dirender & di-query. Tab yang tidak boleh dipakai viewer tidak ditampilkan, dan memintanya lewat URL jatuh ke tab default. Pindah tab membuang parameter paginasi/filter tab lain.
- **Isi**: tiap bagian berupa `Card`; baris daftar bisa diklik penuh. Form panjang dua kolom di layar ≥ sm, tombol simpan di kanan bawah.
- Halaman daftar (`/dashboard/statistik`, `/dashboard/pengguna`, …) memakai header yang sama tanpa breadcrumb di akar bagian; tab `/dashboard/statistik` mempertahankan filter grup & rentang antar tab.
- Halaman check-in (`/absen`) dan `/dashboard/akun/password` (layar wajib ganti password) tetap tata letak terpusat tanpa header ini.

---

## 8. Stack & praktik

- **Next.js 16 App Router** (Turbopack), Server Actions untuk mutasi, Server Components untuk list.
- **Prisma 7 + SQLite** via driver adapter `@prisma/adapter-better-sqlite3` (file lokal, tanpa server DB terpisah — juga dipakai di production). `prisma db seed` (`prisma/seed.ts`) membuat org, 4 level, contoh pohon, ~30 anggota, kegiatan contoh (termasuk yang saling konflik, riwayat absensi, dan kasus tepi seperti split/akhiri/hapus) — **development only**. Production dibuat lewat `pnpm bootstrap` (`prisma/bootstrap.ts`): org + level + satu grup akar + satu user OWNER, tanpa data contoh. Lihat DEPLOYMENT.md.
- **Auth**: Auth.js v5 Credentials + bcrypt; sesi JWT + validasi ulang per request (§4.1).
- **UI**: Tailwind + shadcn/ui, react-hook-form + zod (skema zod dipakai ulang di Server Action), Recharts untuk grafik.
- **Tes**: Vitest untuk fungsi murni (`expandDates`, konflik, `expected`, `authorize`) dan Server Action lintas-scope (harus gagal-tertutup). `pnpm test` masuk ke CI bersama `pnpm lint && pnpm tsc --noEmit && pnpm audit`.
- **Tanggal**: kolom `String` (`YYYY-MM-DD`) di DB (SQLite tanpa tipe DATE native) & string `HH:mm` untuk jam; satu timezone organisasi (`Asia/Jakarta`); string `YYYY-MM-DD` di seluruh kode aplikasi maupun DB, tanpa konversi Date↔string untuk tanggal murni.
- **Validasi server-side wajib** untuk: depth grup = parent+1, anggota hanya di grup daun, scope & aturan §3 untuk semua mutasi, tanggal absensi sah.
- Setiap tabel punya `createdAt/updatedAt`; `createdById`/`recordedById` ber-FK; `AuditLog` untuk jejak perubahan.

### Urutan pengerjaan (target 2 hari; rincian, spesifikasi & skenario uji di `openspec/changes/ngaji-mvp/`)
1. Scaffold Next + Prisma + SQLite + shadcn + Vitest — 1 jam
2. Schema, migrasi, seed, `lib/dates.ts`, `lib/constants.ts` — 1 jam
3. Logika murni (TDD, tanpa UI): `expandDates`, `occurrencesFor`, konflik, `expected` — 1.5 jam
4. Auth: login + rate limit + validasi ulang sesi + `mustChangePassword` + `/dashboard/akun/password` + header keamanan — 1.5 jam
5. `authorize` / `visibleGroupsWhere` / `audit()` + tes lintas-scope — 1 jam
   **Checkpoint**: akses lintas-scope gagal tertutup; user nonaktif langsung terlempar.
6. Grup: pohon + CRUD (soft) + rename level — 1.5 jam
7. Anggota: list (paginasi) / cari / filter + form + soft delete — 1.5 jam
8. Kegiatan: form + daftar rentang tanggal + konflik + override/geser/split — 2.5 jam
9. Absensi — 1 jam
10. Statistik (3 tab) — 1.5 jam
11. Pengguna (§3.2/§3.4) — 1 jam
12. Audit log page — 0.5 jam

---

## 9. Keputusan tambahan (sudah dikonfirmasi)

1. ADMIN boleh membuat user USER/ADMIN dalam scope; OWNER saja yang bisa membuat OWNER, mengubah peran, memindahkan, dan menonaktifkan user.
2. Sub-grup tidak bisa opt-out dari kegiatan warisan.
3. Satu timezone `Asia/Jakarta` (per-grup timezone: nanti).
4. `WorkStatus` memisahkan pelajar menjadi SD / SMP / SMA.
5. Kelompok umur dapat diubah nanti (konstanta terpusat di `lib/constants.ts`).
6. Kegiatan berulang: edit template, batalkan per tanggal, geser satu kali, geser ini & seterusnya (split), akhiri mulai tanggal tertentu.
7. Auth.js v5 Credentials; `isActive`/`role` divalidasi ulang tiap request.
8. Rentang statistik default 30 hari.
9. Pindah grup ke parent lain & riwayat mutasi anggota: bukan MVP.
10. Edit kegiatan & occurrence hanya oleh user (≥ ADMIN) tepat di grup pemilik; absensi oleh user di grup pemilik atau di bawahnya.
11. Reset password: OWNER untuk siapa pun dalam scope; ADMIN hanya USER di grupnya sendiri.
12. Tidak ada hard delete; semua perubahan tercatat di `AuditLog` dalam transaksi yang sama.
13. Minggu dimulai hari Minggu.
14. Absensi hanya untuk grup daun dan tanggal ≤ hari ini.
15. `expected` memperhitungkan `joinedAt` / `exitedAt` agar % kehadiran tidak melenceng karena anggota baru/keluar.
16. User di **atas** grup pemilik kegiatan (mis. admin daerah untuk kegiatan kelompok) hanya bisa melihat — tidak bisa mengisi absensi.
17. OWNER root **tidak** punya jalur darurat untuk mengubah kegiatan grup di bawahnya.

## 10. Non-MVP (sudah disiapkan jalurnya)

| Fitur | Persiapan di MVP |
|---|---|
| Relasi anggota (ayah, ibu, saudara, suami/istri, anak) | Tabel `MemberRelation(memberId, relatedId, type)` — tambah nanti, tidak mengubah `Member`. |
| Foto anggota | Kolom `photoUrl` + object storage; tambah nanti. |
| Multi-peran per user | Hapus `@unique` di `UserGroupRole.userId`; scope jadi union path. |
| Syarat peserta kegiatan (perempuan saja, SMP, dll.) | Kolom JSON `criteria` di `Activity`; `expected()` sudah terpusat sehingga tinggal tambah filter. |
| Riwayat pindah grup anggota | Tabel `MemberGroupHistory`; `PINDAH` saat ini membuat baris baru. |
| Ekspor data / cetak | Perlu keputusan kebijakan PII dulu; audit `export.*`. |
| Multi-organisasi | `organizationId` sudah ada di Level/Group. |

---

## 11. Survei

Formulir isian khusus per grup yang diisi per anggota oleh admin/user (tanpa tautan publik), dengan statistik hasil. Spesifikasi & skenario uji: `openspec/changes/member-surveys/`.

### 11.1 Kepemilikan & izin
- Survei milik satu grup X dan berlaku untuk X + semua turunan; tidak ada opt-out. Izin meniru kegiatan (§3.3): **lihat** = X leluhur/grup user atau dalam scope (selain itu 404); **ubah/hapus** = ≥ ADMIN dan `groupId === X` persis (OWNER root pun tidak bisa mengubah survei kelompok); **isi respons** = user di X atau di bawah X, untuk anggota `AKTIF` di grup daun dalam scope. User di atas X hanya melihat.
- `resolveSurvey` (`lib/resolve.ts`) memuat survei (`deletedAt: null`) dan menerapkan `survey.view`; setiap halaman dan action berawal dari survei hasil resolve. `groupId` pemilik tidak pernah diambil dari client saat membuat survei.

### 11.2 Formulir
- Tipe pertanyaan (`QuestionType`): `SINGLE_CHOICE`, `MULTI_CHOICE`, `NUMBER`, `SCALE` (default 1–5, maksimal 11 langkah), `SHORT_TEXT` (≤ 200), `LONG_TEXT` (≤ 2000). Pilihan minimal dua opsi berlabel unik; preset "Ya/Tidak" = `SINGLE_CHOICE` dengan opsi Ya dan Tidak. Batas (`SURVEY_*`, `SCALE_MAX_STEPS`, dll.) ada di `lib/constants.ts`.
- Tanpa status buka/tutup/draf: survei menerima jawaban selama belum dihapus (soft).
- **Terkunci setelah dijawab, bukan versi.** Kunci diturunkan dari data (ada `SurveyAnswer` untuk pertanyaan/opsi), tidak disimpan. Pertanyaan terjawab: tipe dan rentang skala tidak bisa berubah; tidak bisa dihapus, hanya diarsipkan (`archivedAt`); opsi terjawab juga hanya diarsipkan. Label, teks bantuan, wajib-isi, dan urutan tetap bisa diubah; pertanyaan/opsi baru selalu boleh; arsip bisa dipulihkan. Yang belum pernah dijawab dihapus permanen.
- Mengganti label opsi terjawab melabeli ulang jawaban lama (disengaja untuk koreksi salah ketik; formulir memberi peringatan, audit menyimpan label lama).
- Satu simpan = satu payload formulir utuh = satu audit `survey.update` (before/after). Fungsi murni `planFormUpdate` (`lib/survey/form-plan.ts`) membandingkan payload dengan formulir saat ini dan mengembalikan operasi (buat/ubah/arsip/hapus) atau daftar pelanggaran.

### 11.3 Respons
- Satu respons per (survei, anggota); menyimpan lagi **menimpa semua jawaban** kecuali jawaban untuk pertanyaan/opsi yang sudah diarsipkan (dipertahankan, tampil read-only di form). Konkurensi ditangani indeks unik.
- Validasi server (`validateAnswers`, `lib/survey/answers.ts`): id pertanyaan/opsi harus milik survei dan tidak diarsip; aturan per tipe; pertanyaan wajib harus terjawab; opsional boleh kosong (tidak ada baris). Error dilaporkan per pertanyaan; satu salah = tidak ada yang tertulis.
- Hapus respons = permanen (seperti absensi); anggota yang sudah `KELUAR` masih boleh dihapus responsnya tapi tidak bisa diisi.
- Tidak ada baris "belum mengisi": belum mengisi = anggota *expected* tanpa `SurveyResponse` (seperti absen, §2).

### 11.4 Statistik
- Satu grup terpilih G (`?grup=`, harus dalam scope, selain itu 404). Default: X bila dalam scope, jika tidak grup user. **Populasi** = anggota yang belum dihapus di subtree(G) ∩ subtree(X), dipersempit filter demografi (jenis kelamin, kelompok umur dari `AGE_BRACKETS` dihitung per hari ini di Asia/Jakarta, status kerja, status nikah; nilai tidak valid diabaikan).
- Tingkat respons: *expected* = populasi berstatus `AKTIF`; *terjawab* = expected yang punya respons; daftar "Belum mengisi" dipaginasi dengan tautan isi. Respons anggota yang sudah tidak `AKTIF` tetap dihitung di hasil per pertanyaan tetapi tidak di expected/terjawab.
- Per pertanyaan (termasuk yang diarsip, ditandai): jumlah terjawab; pilihan = jumlah & % per opsi relatif terhadap jumlah terjawab (multi-pilihan bisa > 100%); angka = jumlah/rata-rata/min/maks; skala = rata-rata + sebaran semua nilai (nol ditampilkan); teks = daftar terbaru dulu, hanya satu daftar yang dipaginasi lewat `?teks=`.
- Rincian per anak langsung G (yang beririsan dengan subtree X): tingkat respons dan hitungan opsi/nilai per anak.
- Hasil selalu dibatasi scope viewer, walau survei terlihat karena pewarisan: jawaban anggota di luar scope tidak pernah masuk angka maupun daftar. Query berupa `groupBy` terfilter populasi (`lib/survey/stats.ts`); helper murni (`summarizeChoice`, `summarizeScale`, `ageBracketRange`) di `lib/survey/summary.ts`.

### 11.5 Tidak termasuk (non-MVP)
Tautan survei publik / isian mandiri, status buka-tutup, respons berulang per anggota, pertanyaan bersyarat, unggah berkas, ekspor hasil (butuh kebijakan PII, §10), dan "duplikat survei" untuk putaran berikutnya.

---

## 12. Tampilan anggota

Daftar anggota tersimpan dengan aturan penyaring, urutan, pengelompokan, dan kolom sendiri, per grup. Spesifikasi & skenario uji: `openspec/changes/member-views/`. `/dashboard/anggota` tidak berubah.

### 12.1 Kepemilikan & izin
- Tampilan milik satu grup (grup pembuat saat dibuat, tidak pernah dari client) dan **hanya terlihat oleh user di grup itu persis**; leluhur, turunan, dan cabang lain mendapat 404 (beda dari survei/kegiatan, tidak ada pewarisan). Tampilan terhapus dianggap tidak ada.
- Semua peran boleh membuat. Hanya **pemilik** yang boleh mengubah/menghapus (403 untuk yang lain, ADMIN pun). Tampilan *yatim* = pemilik nonaktif atau sudah pindah grup: ADMIN/OWNER grup itu dapat "Ambil alih" (`member_view.transfer`); selain itu ditolak.
- Nama unik per grup di antara tampilan yang belum dihapus, tanpa beda huruf besar/kecil; nama tampilan terhapus boleh dipakai ulang. `source` hanya `member`, `visibility` hanya `GROUP`.
- `resolveMemberView` (`lib/resolve.ts`) memuat tampilan beserta pemiliknya; setiap halaman dan action berawal dari entitas hasil resolve lalu `authorize`.

### 12.2 Definisi
- `{ version: 1, filter, sort, groupBy?, columns }` (`lib/validation/member-view.ts`, satu skema zod untuk tampilan tersimpan dan draf URL). `filter` = konjungsi teratas (`AND`/`OR`) atas 0–`VIEW_MAX_RULE_GROUPS` grup aturan, masing-masing konjungsi atas 1–`VIEW_MAX_RULES_PER_GROUP` aturan; satu tingkat saja. Filter kosong = semua anggota dalam scope.
- Medan & operator ada di satu registri (`lib/member-view/fields.ts`): teks (nama, tempat lahir), pilihan (jenis kelamin, status, status nikah, pekerjaan), tanggal (tanggal lahir, masuk, keluar + kosong/tidak kosong, "dalam N hari terakhir"), usia (bilangan bulat), grup (subtree). **`phone`, `address`, `email` tidak ada di registri**, jadi tidak bisa untuk aturan, urutan, atau pengelompokan; hanya boleh tampil sebagai kolom.
- Usia dihitung saat melihat (Asia/Jakarta), diubah menjadi batas tanggal lahir berupa string sehingga tetap dihitung di database dan cocok dengan `ageInYears` (termasuk 29 Februari). Satu kunci urut + pemecah seri nama, id; urut usia membalik arah di `birthDate`.
- Pengelompokan: sifat pilihan, tingkat grup (dari kedalaman grup tampilan sampai daun; seksi = leluhur di tingkat itu), atau kelompok umur (1–`VIEW_MAX_AGE_BUCKETS`, tidak boleh tumpang tindih, awal dari `AGE_BRACKETS`; sisanya "Lainnya"). Seksi kosong tidak ditampilkan.
- Dua mode parse: **ketat** saat simpan (masalah apa pun menolak, batas tidak dipotong) dan **longgar** saat muat/draf (aturan rusak dibuang dengan peringatan, sehingga tampilan lama tetap terbuka). Id grup di-resolve di server: simpan menolak id di luar scope/terhapus; muat membuang aturannya dengan pemberitahuan "Beberapa aturan diabaikan karena tidak berlaku lagi".
- Hasil selalu `deletedAt: null` + scope user, di-AND dengan `buildWhere(definition, today)` (`lib/member-view/query.ts`), sehingga definisi tak pernah bisa melewati scope. Tanpa pengelompokan: tabel `PAGE_SIZE` (`?page=`); dengan pengelompokan: seksi bisa dilipat (`VIEW_EXPANDED_SECTIONS` pertama terbuka), `VIEW_SECTION_PAGE_SIZE` anggota pertama + "Tampilkan lebih banyak" (server action yang memvalidasi ulang semuanya). Hanya kolom terpilih yang dirender di server.

### 12.3 Draf & simpan
- Perubahan aturan/urutan/pengelompokan/kolom langsung berlaku sebagai **draf di URL** (`?d=` = JSON base64url, maks. `VIEW_MAX_DRAFT_LENGTH`), ditandai "Belum disimpan", tidak menulis ke database dan tidak diaudit. Draf rusak/terlalu panjang → tampilan tersimpan dengan pemberitahuan generik.
- Pemilik: **Simpan** (timpa; definisi dikirim lalu divalidasi ketat) dan **Batalkan** (hapus `?d`). Semua user di grup: **Simpan sebagai baru** (dialog nama, jadi milik user, lalu pindah ke tampilan baru) — selalu tampil, juga di `/dashboard/tampilan/baru`. Pemilik: **Ubah nama** (dialog). Hapus: zona berbahaya, konfirmasi dialog, kembali ke `/dashboard/tampilan`.
- `/dashboard/tampilan/baru` mulai dari definisi awal: status salah satu dari `AKTIF`, urut nama naik, tanpa pengelompokan, kolom default anggota.
- Audit: `member_view.create/update/delete/transfer` di transaksi yang sama (§4.5). Teks filter bisa memuat nama (PII), itu sebabnya audit hanya untuk OWNER dalam scope.
