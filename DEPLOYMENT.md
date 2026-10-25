# Deployment Guide (IDCloudHost)

Production deployment of Dahan on a single IDCloudHost Cloud VPS, with encrypted daily backups to IDCloudHost Object Storage. Local development setup is in [README.md](README.md). Architecture context: [DESIGN.md](DESIGN.md) §8.

The reference files live in the repository and are copied to the server in the steps below:

| File | Installed at |
|---|---|
| `deploy/nginx/ngaji.conf` | `/etc/nginx/sites-available/ngaji.conf` |
| `deploy/systemd/ngaji.service` | `/etc/systemd/system/ngaji.service` |
| `deploy/systemd/ngaji-backup.service`, `ngaji-backup.timer` | `/etc/systemd/system/` |
| `deploy/env/backup.env.example` | `/etc/ngaji/backup.env` |
| `deploy/rclone.conf.example` | `/home/ngaji/.config/rclone/rclone.conf` |
| `scripts/backup.sh`, `scripts/restore.sh` | run in place from `/opt/ngaji/scripts/` |

## 1. Architecture constraints (read first)

- The app uses **SQLite as a local file** (`@prisma/adapter-better-sqlite3`). That is deliberate (DESIGN.md §8).
- It must run as **exactly one long-lived Node.js process** on a server with a **persistent disk**. The login rate limiter uses an in-process lock that is only correct with one process. Never run two instances, and never use serverless/edge platforms.
- The process listens on **127.0.0.1:3000 only**. Nginx is the only way in, terminates TLS, and overwrites the forwarding headers so clients cannot spoof their IP.
- The database holds **member PII**. It stays out of git, is readable only by the `ngaji` user, and leaves the server only encrypted.
- Targets: RPO ≤ 24 h (daily backup), RTO ≤ 1 h for "VPS lost".

## 2. Order the VPS

In the IDCloudHost console:

1. Create a **Cloud VPS**: Ubuntu 24.04 LTS, **2 vCPU / 2 GB RAM / 40 GB NVMe**, Jakarta data center. Hourly billing is fine for the rehearsal; use monthly billing for production.
2. Add your SSH **public key** at creation time.
3. If your plan offers a network firewall, allow inbound **22, 80, 443** only. This is in addition to `ufw` below. *Check in the console whether your plan includes it.*
4. Point a DNS `A` record for your domain (e.g. `ngaji.example.org`) at the VPS IP. Do this now so certbot works in §6.

## 3. First-boot hardening

SSH in as the initial user, then:

```bash
# Updates and tools
sudo apt update && sudo apt -y upgrade
sudo apt -y install ufw fail2ban unattended-upgrades sqlite3 nginx certbot python3-certbot-nginx curl git rclone age build-essential python3

# Timezone: timers and the app's day boundary use Asia/Jakarta
sudo timedatectl set-timezone Asia/Jakarta

# 2 GB swap so `pnpm build` is not OOM-killed
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Dedicated app user (no login password)
sudo adduser --disabled-password --gecos "" ngaji

# Firewall: only SSH, HTTP, HTTPS
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable

# Automatic security updates
sudo dpkg-reconfigure -plow unattended-upgrades
```

SSH: key-only, no root login. **Before** closing your session, confirm key login works from a second terminal.

```bash
sudo tee /etc/ssh/sshd_config.d/99-ngaji.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
sudo sshd -t && sudo systemctl reload ssh
```

fail2ban (sshd jail is enabled by default on Ubuntu):

```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

Plan a monthly reboot window so kernel updates apply.

## 4. Install the application

Node 24 LTS via NodeSource, pnpm via corepack:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt -y install nodejs
sudo corepack enable
```

Code and data directories:

```bash
sudo mkdir -p /opt/ngaji /var/lib/ngaji /var/backups/ngaji /etc/ngaji
sudo chown ngaji:ngaji /opt/ngaji /var/lib/ngaji /var/backups/ngaji
sudo chmod 700 /var/lib/ngaji /var/backups/ngaji
sudo -u ngaji git clone <your-repo-url> /opt/ngaji
cd /opt/ngaji
sudo -u ngaji pnpm install --frozen-lockfile
```

`/opt/ngaji/.env` (mode 600, owned by `ngaji`, never committed):

```bash
DATABASE_URL="file:/var/lib/ngaji/production.db"
AUTH_SECRET="<output of: openssl rand -base64 32>"
AUTH_TRUST_HOST="true"
# Optional: WhatsApp number the /daftar form hands visitors to (Indonesian format)
DAHAN_WHATSAPP="08xxxxxxxxxx"
# Optional: show the organization name on /login (only when exactly one organization exists)
LOGIN_SHOW_ORG_NAME="true"
```

```bash
sudo -u ngaji chmod 600 /opt/ngaji/.env
```

- Generate a fresh `AUTH_SECRET` for production; never reuse the development one.
- `DATABASE_URL` is an **absolute** path so the data lives outside the code directory.
- `AUTH_TRUST_HOST=true` is required behind Nginx.
- `DAHAN_WHATSAPP` (optional) is the contact number the public `/daftar` form sends visitors to (WhatsApp, with their details prefilled) after their submission is stored. It is read on the server at request time, so changing it needs only a service restart, not a rebuild. If unset or invalid, the submission is still stored and the visitor sees a confirmation without the WhatsApp link.
- `LOGIN_SHOW_ORG_NAME` (optional, default off) brings the organization name back on `/login` and in its page title. It applies only when exactly one organization exists; with two or more, or any value other than `true`, the login page stays generic (Dahan only). A deployment that ran as single-organization before this release shows the generic login until you set it.
- `NODE_ENV=production` is set by the systemd unit. Session cookies are `secure` and HSTS is sent only in production, so HTTPS must work (§6) before go-live.

Generate the Prisma client and apply migrations (use `migrate deploy`, never `migrate dev`):

```bash
cd /opt/ngaji
sudo -u ngaji pnpm prisma generate
sudo -u ngaji pnpm prisma migrate deploy
```

`lib/generated/prisma` is not committed, so `prisma generate` is needed after every install.

### Create an organization and its first OWNER

Do **not** run `pnpm prisma db seed` in production (it creates fake sample data). Use `pnpm org:create` (`pnpm bootstrap` is an alias), which creates one organization, its levels, a root group and one OWNER. It works on an empty database and on one that already has organizations, so run it again for every additional organization:

```bash
sudo -u ngaji bash -c 'cd /opt/ngaji && cat > /tmp/bootstrap.env' <<'EOF'
BOOTSTRAP_ORG_NAME=Your Organization
BOOTSTRAP_ROOT_GROUP_NAME=Pusat
BOOTSTRAP_TIMEZONE=Asia/Jakarta
BOOTSTRAP_OWNER_USERNAME=owner
BOOTSTRAP_OWNER_NAME=Owner Full Name
BOOTSTRAP_OWNER_PASSWORD=<strong password, min 8 chars>
EOF
sudo -u ngaji bash -c 'cd /opt/ngaji && set -a && . /tmp/bootstrap.env && set +a && pnpm org:create; rm -f /tmp/bootstrap.env'
```

- The script aborts, writing nothing, if the owner username is already taken by any organization (usernames are unique across all organizations and stored in lowercase), if the timezone is invalid or if the password is shorter than 8 characters. The password is never printed.
- `BOOTSTRAP_TIMEZONE` is optional: `Asia/Jakarta` (WIB, default), `Asia/Makassar` (WITA) or `Asia/Jayapura` (WIT). The OWNER can change it later under `/dashboard/pengaturan`.
- `BOOTSTRAP_LEVEL_NAMES` is optional (default `pusat,daerah,desa,kelompok`); the OWNER can rename levels later under `/dashboard/pengaturan`.
- The OWNER is created with `mustChangePassword = true` and must change it on first login (DESIGN.md §3.4).
- Creation is audited (`organization.create`, `user.create`, `actorId = null`).

### Interest sign-ups (`/daftar`)

The public `/daftar` form stores each submission as an interest lead (name, WhatsApp number, organization name, optional member count and message, consent timestamp, IP and user agent). Leads belong to no organization and have no web UI. List them on the server:

```bash
cd /opt/ngaji
sudo -u ngaji pnpm leads            # table, newest first (times in UTC)
sudo -u ngaji pnpm leads --csv > leads.csv
```

`pnpm leads` is read-only. The form is limited per client IP (see `INTEREST_RATE_LIMIT_*` in `lib/constants.ts`) using the `X-Forwarded-For` / `X-Real-IP` headers, which `deploy/nginx/ngaji.conf` sets from `$remote_addr`; a request without either header is stored without a limit, so do not remove those lines. Leads contain personal data: keep exports off shared drives and delete them when done.

### Build and start

```bash
cd /opt/ngaji
sudo -u ngaji pnpm build

sudo cp deploy/systemd/ngaji.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ngaji
sudo systemctl status ngaji
curl -sI http://127.0.0.1:3000/login | head -1
```

If `which pnpm` is not `/usr/bin/pnpm`, edit `ExecStart` in the unit first.

## 5. Dependency audit gate

Run before every deploy and upgrade:

```bash
cd /opt/ngaji && pnpm audit --prod
```

**Do not deploy** while it reports a high or critical advisory in a runtime package without a recorded exception below.

### Recorded exceptions

| Date | Advisory | Path | Reason accepted | Revisit |
|---|---|---|---|---|
| 2026-10-10 | `mysql2` (GHSA-rgwj-5xj2-c3m3 high, + one moderate) | `@prisma/client › prisma › mysql2` | Prisma CLI tooling only. The app uses SQLite and never loads the MySQL driver at runtime. | On the next Prisma upgrade |
| 2026-10-10 | `fast-uri` (GHSA-hrr3-gc8f-f4qj, moderate) | `@hookform/resolvers › ajv › fast-uri` | Moderate; transitive dependency of the form-validation resolver. Not reachable from untrusted URLs in this app. Re-check when a patched version is available. | On the next `@hookform/resolvers` upgrade |

Re-run the audit at each upgrade and update this table; delete rows that are fixed.

## 6. Nginx and TLS

```bash
sudo cp /opt/ngaji/deploy/nginx/ngaji.conf /etc/nginx/sites-available/ngaji.conf
sudo sed -i 's/ngaji.example.com/ngaji.example.org/g' /etc/nginx/sites-available/ngaji.conf   # your domain
sudo rm -f /etc/nginx/sites-enabled/default
```

The config references certificates that do not exist yet, so get them first, then enable the site:

```bash
sudo certbot certonly --nginx -d ngaji.example.org
sudo ln -s /etc/nginx/sites-available/ngaji.conf /etc/nginx/sites-enabled/ngaji.conf
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl list-timers | grep certbot     # auto-renew timer present
```

Verify:

```bash
curl -I http://ngaji.example.org/login          # 301 to https
curl -I https://ngaji.example.org/login         # 200, with Content-Security-Policy and Strict-Transport-Security
```

Security headers come from the app. Do not add them in Nginx or they duplicate.

## 7. Backups

Daily at 02:00 Asia/Jakarta: online SQLite copy, integrity check, gzip, **age** encryption with a public key, upload to Object Storage. The server never holds the private key, so a compromised server cannot read backups.

### 7.1 Generate the age key (on your laptop, not the server)

```bash
age-keygen -o ngaji-backup.age.key
```

- It prints the public recipient (`age1…`). That goes on the server.
- The file `ngaji-backup.age.key` is the **private key**. Store it in your password manager **and** print a copy to keep offline. **If it is lost, every backup is unreadable.**
- Never copy it to the server except temporarily during a restore (§8).

### 7.2 Object Storage bucket and key

In the IDCloudHost console:

1. Create an Object Storage bucket (e.g. `ngaji-backup-<random>`), private.
2. Create an access key **scoped to this bucket only**, if the console supports per-bucket keys. *Check in the console.*
3. Note the S3 endpoint and region. *Take them from the console; they are not hard-coded in this repo.*
4. Enable **versioning or object lock** if available, so a compromised server cannot silently delete backups. *Check in the console; if unavailable, note it as an accepted risk.*

### 7.3 Configure the server

```bash
# rclone remote "idch"
sudo -u ngaji mkdir -p /home/ngaji/.config/rclone
sudo -u ngaji cp /opt/ngaji/deploy/rclone.conf.example /home/ngaji/.config/rclone/rclone.conf
sudo -u ngaji chmod 600 /home/ngaji/.config/rclone/rclone.conf
sudo -u ngaji nano /home/ngaji/.config/rclone/rclone.conf     # access key, secret, endpoint

# Backup settings
sudo cp /opt/ngaji/deploy/env/backup.env.example /etc/ngaji/backup.env
sudo chown ngaji:ngaji /etc/ngaji/backup.env && sudo chmod 600 /etc/ngaji/backup.env
sudo nano /etc/ngaji/backup.env     # BACKUP_BUCKET, AGE_RECIPIENT (public), HEALTHCHECK_URL
```

The real `backup.env` and `rclone.conf` are git-ignored; only the `*.example` files are committed.

### 7.4 Alerting (healthchecks.io)

1. Create a free healthchecks.io check: period **1 day**, grace **2 hours**.
2. Add your email/phone as the notification channel.
3. Put its ping URL in `HEALTHCHECK_URL`.

The script pings `/fail` on any error, and a missed ping alerts via the grace period, so one check covers both "failed" and "never ran". Pings contain no PII.

### 7.5 Enable the timer

```bash
cd /opt/ngaji
sudo cp deploy/systemd/ngaji-backup.service deploy/systemd/ngaji-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ngaji-backup.timer
sudo systemctl start ngaji-backup.service       # run once now
journalctl -u ngaji-backup.service -n 30
rclone lsf idch:<bucket>/daily/ --config /home/ngaji/.config/rclone/rclone.conf
```

Retention (done by the script): bucket keeps 30 days of `daily/` and 12 months of `monthly/` (first backup of each month); the server keeps the newest 7 locally in `/var/backups/ngaji`.

## 8. Restore runbook

Use this for "database damaged" or "VPS lost". Time budget: under 1 hour.

**VPS lost:** redo §2–§6 on a new VPS (skip bootstrap), then restore below.

1. Copy the private key to the server temporarily:
   ```bash
   scp ngaji-backup.age.key you@server:/tmp/ngaji-restore.key
   ```
2. Restore (root; loads the bucket settings from `backup.env`):
   ```bash
   sudo bash -c 'set -a; . /etc/ngaji/backup.env; set +a; \
     rclone --config /home/ngaji/.config/rclone/rclone.conf lsf idch:$BACKUP_BUCKET/daily/ | tail -3'
   sudo bash -c 'set -a; . /etc/ngaji/backup.env; set +a; export RCLONE_CONFIG=/home/ngaji/.config/rclone/rclone.conf; \
     /opt/ngaji/scripts/restore.sh daily/ngaji-<YYYY-MM-DD>.db.gz.age /tmp/ngaji-restore.key'
   ```
   A local file also works: `restore.sh /var/backups/ngaji/ngaji-<date>.db.gz.age /tmp/ngaji-restore.key`.
3. Shred the key: `shred -u /tmp/ngaji-restore.key`.
4. Log in and check recent data.

What the script does: decrypt → integrity check → stop service → keep the old DB as `production.db.pre-restore-<timestamp>` → install the restored file (mode 600, owner `ngaji`) → start → request `/login`. A wrong key or a corrupt backup aborts **before** production is touched. Delete the `.pre-restore-*` file once you are sure.

### Drill log

Do a drill **at least once per quarter**: restore the latest bucket backup onto a scratch hourly VPS with the offline key, check login and recent data, then delete the VPS.

| Date | Backup restored | By | Result |
|---|---|---|---|
| _(pending first drill)_ | | | |

## 9. Upgrade procedure

Every release gets its own document in [docs/releases/](docs/releases/README.md), created from the template **before** deploying. It holds the release-specific risks, extra steps, and the sanity-check results; this section stays the generic procedure.

1. Run a fresh backup: `sudo systemctl start ngaji-backup.service` and confirm it succeeded.
2. Take a **VPS snapshot** in the IDCloudHost console.
3. Run the audit gate (§5).
4. Deploy:
   ```bash
   cd /opt/ngaji
   sudo -u ngaji git pull
   sudo -u ngaji pnpm install --frozen-lockfile
   sudo -u ngaji pnpm prisma generate
   sudo -u ngaji pnpm prisma migrate deploy
   sudo -u ngaji pnpm build
   sudo systemctl restart ngaji
   ```
5. Check `curl -I https://<domain>/login` and log in.

**Rollback:** if a migration fails or the app misbehaves, restore the VPS snapshot, or run `scripts/restore.sh` with the pre-upgrade backup (§8) and redeploy the previous commit. New columns are ignored by older code.

## 10. Recovery: lost OWNER password

Run on the server as the `ngaji` user. The temporary password is printed once; the account must change it at next login and all its sessions end.

```bash
cd /opt/ngaji
sudo -u ngaji pnpm reset-owner-password <username> [--activate]
```

The action is audited with `actorId = null` and `meta.via = "cli"`. It exits non-zero for an unknown username.

## 11. Go-live checklist

- [ ] `AUTH_SECRET` is unique to production
- [ ] `.env` mode 600, DB in `/var/lib/ngaji` (mode 700)
- [ ] `pnpm audit --prod` clean or exceptions recorded in §5
- [ ] From outside: port 3000 refused; `http://` redirects to `https://`
- [ ] `curl -I https://<domain>/login` shows CSP and HSTS
- [ ] Password SSH login refused; root SSH login refused; `ufw status` shows only 22/80/443
- [ ] Every organization's OWNER changed the bootstrap password after first login
- [ ] `LOGIN_SHOW_ORG_NAME` set only if this deployment hosts exactly one organization and you want its name on `/login`
- [ ] `pnpm prisma db seed` was **never** run against this database
- [ ] Backup timer enabled; `daily/` and `monthly/` objects exist; healthchecks.io shows success
- [ ] A failed backup (e.g. wrong endpoint) triggers an alert
- [ ] `age` private key stored in password manager **and** printed copy
- [ ] At least one restore drill passed and is logged in §8, **before** real data is entered
- [ ] Users were told they must log in again once after this deploy (sessions without `sessionVersion` are ended)
