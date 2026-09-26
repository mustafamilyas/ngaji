# Panduan Deployment

Panduan ini untuk deployment production, terpisah dari [README.md](README.md) (setup lokal). Baca [DESIGN.md](DESIGN.md) §8 untuk konteks arsitektur.

## 1. Batasan arsitektur — baca ini dulu

Aplikasi ini memakai **SQLite sebagai file lokal** (`@prisma/adapter-better-sqlite3`), bukan server database terpisah — ini keputusan desain yang sengaja (DESIGN.md §8), bukan cuma untuk development. Konsekuensinya:

- **Harus satu proses Node.js yang hidup terus** (long-running), di server dengan **disk persisten**. Middleware auth (`proxy.ts`) juga sengaja jalan di Node.js runtime, bukan Edge, karena butuh query Prisma langsung.
- **Tidak cocok untuk platform serverless/edge klasik** — Vercel Serverless/Edge Functions, Netlify Functions, Cloudflare Workers, dll. Platform-platform itu punya filesystem *ephemeral* atau *read-only* dan bisa menjalankan banyak instance sekaligus tanpa berbagi disk — file SQLite akan hilang atau tidak konsisten antar instance.
- **Cocok untuk**: VPS biasa (systemd/pm2), atau container di platform yang menyediakan *volume* persisten (Fly.io, Railway, dll). Panduan di bawah pakai VPS + systemd + Nginx sebagai jalur utama; lihat §11 untuk alternatif container.
- File database berisi **PII (data anggota)** — wajib di luar git (`*.db` sudah di `.gitignore`), permission dibatasi ke user aplikasi, dan masuk rencana backup.

## 2. Prasyarat di server

- Linux (Ubuntu 22.04+/Debian 12+ atau sejenis) dengan akses root/sudo
- Node.js 20+ (24 dipakai saat pengembangan)
- pnpm (`corepack enable && corepack prepare pnpm@10 --activate`)
- Nginx + certbot, jika memakai domain sendiri dengan HTTPS (sangat disarankan — sesi login memakai cookie yang butuh HTTPS di production, lihat `auth.ts`)
- Satu user khusus untuk menjalankan aplikasi (jangan root), misal `ngaji`

## 3. Ambil kode & install dependencies

```bash
sudo mkdir -p /opt/ngaji && sudo chown ngaji:ngaji /opt/ngaji
sudo -u ngaji git clone <url-repo-anda> /opt/ngaji
cd /opt/ngaji
pnpm install --frozen-lockfile
```

## 4. Siapkan lokasi database (di luar direktori kode)

Simpan file SQLite **di luar** direktori kode, supaya `git pull` / redeploy berikutnya tidak pernah menyentuhnya dan backup lebih mudah dipisahkan dari kode:

```bash
sudo mkdir -p /var/lib/ngaji
sudo chown ngaji:ngaji /var/lib/ngaji
sudo chmod 700 /var/lib/ngaji
```

## 5. Konfigurasi environment (`.env`)

Buat `/opt/ngaji/.env` (jangan commit ke git):

```bash
DATABASE_URL="file:/var/lib/ngaji/production.db"
AUTH_SECRET="<hasil: openssl rand -base64 32>"
AUTH_TRUST_HOST="true"
```

Catatan:

- `AUTH_SECRET` **harus digenerate ulang** untuk production — jangan pakai nilai dari `.env` development.
- `DATABASE_URL` di sini memakai **path absolut** (`/var/lib/ngaji/production.db`), bukan `file:./dev.db` seperti di development. `lib/database-url.ts` hanya menulis ulang path *relatif* agar konsisten dipakai oleh app, Prisma CLI, dan seed/bootstrap script (lihat komentarnya) — path absolut dipakai apa adanya, jadi ini cara paling jelas untuk memisahkan lokasi data dari lokasi kode di production.
- `AUTH_TRUST_HOST="true"` wajib ketika Auth.js v5 berjalan di belakang reverse proxy (Nginx) — tanpa ini, Auth.js menolak request karena tidak mengenali host dari header `X-Forwarded-Host`.
- `NODE_ENV=production` diset otomatis oleh `next build`/`next start`; tidak perlu diisi manual. Cookie sesi otomatis memakai `secure` (DESIGN.md §4.1, `auth.ts`) begitu `NODE_ENV=production` — pastikan HTTPS sudah aktif (§9) sebelum go-live, kalau tidak browser akan menolak cookie-nya.

## 6. Generate Prisma Client & jalankan migrasi

```bash
pnpm prisma generate
pnpm prisma migrate deploy
```

- Pakai `migrate deploy`, **bukan** `migrate dev` — `deploy` hanya menerapkan migrasi yang sudah ada, tanpa prompt interaktif dan tanpa bisa membuat migrasi baru. Ini yang aman untuk dijalankan otomatis saat deploy.
- `pnpm prisma generate` wajib dijalankan manual setiap `pnpm install` di server: `lib/generated/prisma` sengaja tidak dikomit (`.gitignore`) dan tidak ada `postinstall` hook yang menjalankannya otomatis.
- Setelah ini, `/var/lib/ngaji/production.db` sudah punya skema lengkap tapi **kosong** (belum ada organisasi/user).

## 7. Sisipkan user pertama (bootstrap)

**Jangan** jalankan `pnpm prisma db seed` di production — itu `prisma/seed.ts`, yang membuat organisasi, ~30 anggota, dan kegiatan **contoh/palsu** khusus untuk development (lihat README.md). Untuk production, pakai `prisma/bootstrap.ts` — hanya membuat satu organisasi, level-levelnya, satu grup akar, dan **satu** user OWNER, tanpa data contoh apa pun:

```bash
BOOTSTRAP_ORG_NAME="Yayasan Ngaji Anda" \
BOOTSTRAP_ROOT_GROUP_NAME="Pusat" \
BOOTSTRAP_OWNER_USERNAME="owner" \
BOOTSTRAP_OWNER_NAME="Nama Pemilik Akun" \
BOOTSTRAP_OWNER_PASSWORD="<password kuat, minimal 8 karakter>" \
pnpm bootstrap
```

Catatan:

- Script menolak berjalan kalau sudah ada `User` di database sama sekali — aman dari klik/jalan dobel.
- `BOOTSTRAP_LEVEL_NAMES` opsional (default `pusat,daerah,desa,kelompok`, dipisah koma). Nama level bisa diganti lagi nanti oleh OWNER lewat `/pengaturan/jenjang`, jadi tidak perlu pas dari awal.
- Owner yang dibuat otomatis punya `mustChangePassword = true` — wajib ganti password saat login pertama (DESIGN.md §3.4).
- Password di atas terekam di history shell selama sesi ini masih terbuka. Setelah selesai, bersihkan riwayatnya (`history -d <nomor-baris>` atau `history -c` kalau sesi ini memang cuma untuk ini), atau jalankan lewat file sementara yang langsung dihapus:
  ```bash
  cat > /tmp/bootstrap.env <<'EOF'
  BOOTSTRAP_ORG_NAME=Yayasan Ngaji Anda
  BOOTSTRAP_ROOT_GROUP_NAME=Pusat
  BOOTSTRAP_OWNER_USERNAME=owner
  BOOTSTRAP_OWNER_NAME=Nama Pemilik Akun
  BOOTSTRAP_OWNER_PASSWORD=<password kuat>
  EOF
  set -a; source /tmp/bootstrap.env; set +a
  pnpm bootstrap
  rm /tmp/bootstrap.env
  ```

## 8. Build & jalankan

```bash
pnpm build
pnpm start   # next start, default port 3000
```

Jangan jalankan `pnpm start` langsung di terminal interaktif untuk production — pakai service manager (systemd di bawah, atau pm2) supaya otomatis restart kalau proses/servernya mati.

## 9. Contoh service systemd

`/etc/systemd/system/ngaji.service` (ganti `ExecStart` sesuai hasil `which pnpm`):

```ini
[Unit]
Description=Ngaji
After=network.target

[Service]
Type=simple
User=ngaji
WorkingDirectory=/opt/ngaji
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/ngaji

[Install]
WantedBy=multi-user.target
```

`.env` di `/opt/ngaji/.env` terbaca otomatis oleh Next.js sendiri (tidak perlu `EnvironmentFile=` di unit ini) — `ProtectSystem=strict` + `ReadWritePaths=/var/lib/ngaji` membatasi proses ini agar hanya bisa menulis ke direktori database.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ngaji
sudo systemctl status ngaji
```

## 10. Reverse proxy (Nginx + TLS)

```nginx
server {
    listen 80;
    server_name ngaji.contoh.org;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ngaji.contoh.org;

    ssl_certificate     /etc/letsencrypt/live/ngaji.contoh.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ngaji.contoh.org/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo certbot --nginx -d ngaji.contoh.org
```

Verifikasi header keamanan (dari DESIGN.md §4.3) sudah terkirim lewat proxy:

```bash
curl -I https://ngaji.contoh.org/login
```

## 11. Update ke versi baru

```bash
cd /opt/ngaji
git pull
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma migrate deploy
pnpm build
sudo systemctl restart ngaji
```

## 12. Backup

- File yang dibackup: `/var/lib/ngaji/production.db` (dan `-wal`/`-shm` di sebelahnya kalau ada saat proses berjalan — hentikan service dulu untuk backup yang konsisten, atau pakai `sqlite3 production.db ".backup '/path/backup.db'"` yang aman dijalankan sambil service tetap hidup).
- Berisi PII — simpan hasil backup terenkripsi dan di luar server yang sama.
- Jadwalkan (cron) dan **uji proses restore-nya**, bukan cuma memastikan file backup ada.

Contoh: skrip backup `/opt/ngaji/backup.sh` (pakai `sqlite3 .backup`, aman dijalankan sambil database sedang aktif):

```bash
#!/bin/sh
set -e
mkdir -p /var/backups/ngaji
sqlite3 /var/lib/ngaji/production.db ".backup '/var/backups/ngaji/production-$(date +%F).db'"
```

```bash
chmod +x /opt/ngaji/backup.sh
```

Lalu jadwalkan lewat cron harian jam 02:00 (`crontab -e` sebagai user `ngaji`):

```cron
0 2 * * * /opt/ngaji/backup.sh
```

## 13. Alternatif: container dengan volume persisten

Bisa juga dikemas sebagai Docker image dan dijalankan di platform yang menyediakan *volume* persisten (Fly.io, Railway, VPS dengan Docker). Intinya sama seperti VPS: satu instance, `DATABASE_URL` menunjuk ke path di dalam volume yang persisten antar deploy — **bukan** filesystem container yang dibuang setiap redeploy, karena itu artinya database kembali kosong setiap kali deploy ulang. Langkah §5–§8 di atas (siapkan lokasi DB, generate, migrate, bootstrap, build, start) tetap sama, cuma dijalankan di dalam container/image build step alih-alih langsung di VPS.

## 14. Checklist sebelum go-live

- [ ] `AUTH_SECRET` unik untuk production (bukan hasil copy dari `.env` development)
- [ ] HTTPS aktif dan http di-redirect ke https
- [ ] `AUTH_TRUST_HOST=true` sudah diset (kalau di belakang reverse proxy)
- [ ] Password OWNER hasil bootstrap sudah diganti setelah login pertama
- [ ] File database ada di luar direktori kode, permission dibatasi ke user aplikasi
- [ ] Backup terjadwal, dan proses restore-nya sudah pernah dicoba sekali
- [ ] `pnpm prisma db seed` **tidak pernah** dijalankan terhadap database ini
