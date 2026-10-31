# Deployment Guide (IDCloudHost)

Production deployment of Dahan on a single IDCloudHost Cloud VPS, with encrypted daily backups to IDCloudHost Object Storage. Local development setup is in [README.md](README.md). Architecture context: [DESIGN.md](DESIGN.md) §8.

> **Docker alternative:** [DEPLOYMENT-DOCKER.md](DEPLOYMENT-DOCKER.md) runs the app as a container and replaces §4 (install), §9 (upgrade) and §10 (password reset) of this guide; everything else here still applies.

The reference files live in the repository and are copied to the server in the steps below:

| File | Installed at |
|---|---|
| `deploy/nginx/dahan.conf` | `/etc/nginx/sites-available/dahan.conf` |
| `deploy/systemd/dahan.service` | `/etc/systemd/system/dahan.service` |
| `deploy/systemd/dahan-backup.service`, `dahan-backup.timer` | `/etc/systemd/system/` |
| `deploy/env/backup.env.example` | `/etc/dahan/backup.env` |
| `deploy/rclone.conf.example` | `/home/dahan/.config/rclone/rclone.conf` |
| `scripts/backup.sh`, `scripts/restore.sh` | run in place from `/opt/dahan/scripts/` |

## 1. Architecture constraints (read first)

- The app uses **SQLite as a local file** (`@prisma/adapter-better-sqlite3`). That is deliberate (DESIGN.md §8).
- It must run as **exactly one long-lived Node.js process** on a server with a **persistent disk**. The login rate limiter uses an in-process lock that is only correct with one process. Never run two instances, and never use serverless/edge platforms.
- The process listens on **127.0.0.1:3000 only**. Nginx is the only way in, terminates TLS, and overwrites the forwarding headers so clients cannot spoof their IP.
- The database holds **member PII**. It stays out of git, is readable only by the `dahan` user, and leaves the server only encrypted.
- Targets: RPO ≤ 24 h (daily backup), RTO ≤ 1 h for "VPS lost".

## 2. Order the VPS

Before you order, have ready: your SSH public key (§2.2), the domain name and access to its DNS, and a payment method. Nothing here needs the repository yet.

### 2.1 Sizing and plan

| Item | Choice | Why |
|---|---|---|
| OS | Ubuntu 24.04 LTS | Matches every command in this guide (`apt`, `ufw`, systemd, Node 24 from NodeSource) |
| CPU / RAM | 2 vCPU / 2 GB | `pnpm build` is the peak; the 2 GB swap in §3 keeps it from being OOM-killed. 1 GB is not enough |
| Disk | 40 GB NVMe, **persistent** | SQLite file, 7 local backups, build output (`node_modules` and `.next` are the bulk). Never ephemeral or serverless storage (§1) |
| Location | Jakarta | Lowest latency for users; matches the `Asia/Jakarta` timezone setting |
| Billing | Hourly for the rehearsal, monthly for production | Hourly lets you delete the rehearsal VPS and stop paying |
| Instances | **Exactly one** | The login rate limiter is in-process (§1) |

Do not add a second VPS, load balancer or autoscaling group. If the plan offers an automatic provider backup or snapshot add-on, it is welcome as an extra layer, but it does **not** replace §7: a snapshot cannot be restored onto a different provider and is not encrypted with a key you hold. Use manual snapshots before upgrades (§9).

### 2.2 Order steps

In the IDCloudHost console:

1. Create a **Cloud VPS** with the specification above. Give it a recognisable name (e.g. `dahan-prod`, or `dahan-rehearsal` for the drill).
2. Add your SSH **public key** at creation time (the `.pub` file, e.g. `~/.ssh/id_ed25519.pub`; generate one with `ssh-keygen -t ed25519` if you have none). Prefer a key to a root password. If the form insists on a password, set a long random one and store it in your password manager; §3 disables password SSH login anyway, and it is also what the web console in step 4 asks for.
3. If your plan offers a network (cloud-level) firewall, create a security group / rule set that allows inbound **22/tcp, 80/tcp, 443/tcp** only (IPv4 and IPv6 if offered), and attach it to the VPS. It filters traffic before it reaches the VM, and is a second layer on top of `ufw` (§3), not a replacement: keep both, with identical rules, so a mistake in one does not expose the server. If you restrict SSH to your own IP here, do it in one place only (see the optional hardening in §3) so that you can find the cause when you lock yourself out. *Check in the console whether your plan includes it; the menu names differ per plan.*
4. Locate the VPS web/VNC console in the panel and confirm you can open it. It is the way back in if a firewall or SSH change locks you out (§3).
5. Note the VPS **public IPv4** (and IPv6 if assigned). Check that it is a static address that survives reboot and stop/start; if the plan makes it optional, reserve it. A changing IP breaks DNS and any SSH allow-list.
6. Point a DNS `A` record for your domain (e.g. `dahan.example.org`) at the VPS IP (add an `AAAA` record only if the VPS has IPv6 **and** ufw has IPv6 enabled, §3). Use a short TTL (300 s) until go-live. Do this now so certbot works in §6. Check propagation before §6:
   ```bash
   dig +short dahan.example.org           # must print the VPS IP
   ```

### 2.3 First login

```bash
ssh <initial-user>@<vps-ip>              # initial user is shown in the console (often root or ubuntu)
```

- On the first connection, compare the host key fingerprint shown by SSH with the one in the console (if it displays one) before typing `yes`.
- If the first login is `root`, do the hardening in §3 from there (it creates the `dahan` user and disables root login); prefer a sudo-capable non-root user if the provider creates one.
- Record in your password manager: VPS name, IP, initial user, console login, and the panel account that owns the VPS. Turn on two-factor authentication on the IDCloudHost account itself: whoever controls the panel controls the server and its snapshots.

### 2.4 Rehearsal first

Order the **hourly** VPS and run §2–§8 on it end to end, including one restore (§8), before the production one. Delete it afterwards (check the panel that the VPS **and** any attached disk, IP or snapshot are gone; leftovers keep billing). The same rehearsal VPS is what the quarterly drill in §8 reuses.

## 3. First-boot hardening

SSH in as the initial user, then:

```bash
# Updates and tools
sudo apt update && sudo apt -y upgrade
sudo apt -y install ufw fail2ban unattended-upgrades sqlite3 nginx certbot python3-certbot-nginx curl rsync rclone age build-essential python3

# Timezone: timers and the app's day boundary use Asia/Jakarta
sudo timedatectl set-timezone Asia/Jakarta

# 2 GB swap so `pnpm build` is not OOM-killed
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Dedicated app user (no login password)
sudo adduser --disabled-password --gecos "" dahan

# Automatic security updates
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Firewall (ufw)

Policy: **deny all inbound except SSH (22), HTTP (80) and HTTPS (443)**. Everything else, including the app's own port 3000, is closed to the outside. The app already binds to `127.0.0.1` only (§1), so the firewall is a second layer: a misconfiguration of one does not expose the app.

| Port | Why it must be open |
|---|---|
| 22/tcp | SSH administration |
| 80/tcp | Redirect to HTTPS **and** certbot HTTP-01 renewal. Do not close it after the first certificate, or renewal fails ~60 days later |
| 443/tcp | The application |

Keep your current SSH session open for the whole procedure. The order matters: set the defaults, **allow SSH before enabling**, then enable.

```bash
# 0. IPv6 must be on, otherwise the rules below only protect IPv4
grep ^IPV6 /etc/default/ufw            # expect IPV6=yes; if not: sudo sed -i 's/^IPV6=.*/IPV6=yes/' /etc/default/ufw

# 1. Defaults
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 2. Allow rules (SSH first). `limit` allows SSH but drops an IP that opens
#    6+ connections in 30 seconds; it complements fail2ban.
sudo ufw limit 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP (redirect, certbot)'
sudo ufw allow 443/tcp comment 'HTTPS'

# 3. Log blocked traffic at a low volume (/var/log/ufw.log)
sudo ufw logging low

# 4. Enable (answer y; existing SSH sessions are not dropped)
sudo ufw enable
sudo ufw status verbose
```

Expected `status verbose`:

```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), deny (routed)
22/tcp (LIMIT IN)   Anywhere
80/tcp  (ALLOW IN)  Anywhere
443/tcp (ALLOW IN)  Anywhere
(and the same three for "(v6)")
```

If `Default` is not `deny (incoming)`, or no `(v6)` rows exist, stop and fix it before continuing.

**Verify from outside** (your laptop, not the server). Only these three ports may answer:

```bash
nc -zv -w3 <server-ip> 22 80 443       # all succeed once nginx is running (§6)
nc -zv -w3 <server-ip> 3000            # must time out / fail
nmap -Pn -p 1-1024,3000,3306,5432,6379,8080 <server-ip>   # optional wider check: everything else "filtered"
```

Port 80 and 443 only answer after Nginx is installed and enabled (§6); until then they show "refused", which is fine.

**Egress.** Outbound stays open (`allow outgoing`) because the server must reach: Ubuntu mirrors (apt), NodeSource and the npm registry (install/build), your git remote, Let's Encrypt (ACME over 80/443), the IDCloudHost Object Storage endpoint (backups), and `hc-ping.com` (healthchecks.io). Restricting egress by hostname is not practical with ufw and is not required here.

**Changing rules later**

```bash
sudo ufw status numbered               # list with indexes
sudo ufw delete <number>               # delete by index (re-run `status numbered` between deletes: indexes shift)
sudo ufw reload                        # re-read rules without dropping connections
```

**Optional hardening**

- *Limit SSH to known IPs.* If your admin IP is static (office/VPN), replace the SSH rule: `sudo ufw delete allow 22/tcp` (or the `limit` rule), then `sudo ufw allow from <your-ip> to any port 22 proto tcp`. Do this only if you have another way in (the console below), since a changed home IP otherwise locks you out.
- *Non-default SSH port.* Reduces log noise only, not real security. If you do it, allow the new port in ufw and the provider firewall **before** changing `Port` in `sshd_config`, and test from a second terminal.
- *Cloudflare or another proxy in front.* If you later put one in front, you can restrict 80/443 to its published IP ranges; the nginx `X-Forwarded-For` handling (`deploy/nginx/dahan.conf`) must then be reviewed, because the interest-form rate limit relies on it (see "Interest sign-ups").

**Locked out?** Use the VPS console (VNC / web console) in the IDCloudHost panel, which does not go through the network firewall, log in with the user password you set for that purpose or reset it from the panel, then run `sudo ufw allow 22/tcp` (or `sudo ufw disable` temporarily) and fix the rule. Test that the console works **before** go-live, while nothing depends on it.

**Interaction with other tools**

- fail2ban inserts its own ban rules ahead of ufw's; `sudo fail2ban-client status sshd` lists currently banned IPs, and `sudo fail2ban-client set sshd unbanip <ip>` releases one. Ban your own IP by mistake and you also need the console.
- Do not install Docker on this host without reading its docs first: published container ports bypass ufw.
- Do not open 3000 "temporarily" for debugging. Use an SSH tunnel instead: `ssh -L 3000:127.0.0.1:3000 you@server`, then browse `http://localhost:3000`.

SSH: key-only, no root login. **Before** closing your session, confirm key login works from a second terminal.

```bash
sudo tee /etc/ssh/sshd_config.d/99-dahan.conf <<'EOF'
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
sudo mkdir -p /opt/dahan /var/lib/dahan /var/backups/dahan /etc/dahan
sudo chown dahan:dahan /opt/dahan /var/lib/dahan /var/backups/dahan
sudo chmod 700 /var/lib/dahan /var/backups/dahan
```

The repository is private, so the server cannot `git clone` it. Instead you **send the code as a file** from your laptop. The same three steps are used for the first install and for every upgrade (§9).

**Step 1: pick the version to deploy (the "ref").** A ref is just a name for one commit: a tag like `v0.1.0`, or `HEAD` for your latest commit. On your laptop, in the repository:

```bash
git status --short        # must print nothing; commit your changes first (only committed files are sent)
git tag                   # lists existing release tags
git tag v0.1.0            # create the tag for this release (next time v0.1.1, ...)
```

No tag wanted? Use `HEAD` as the ref below. To see recent commits: `git log --oneline -5`.

**Step 2: send it** (laptop, replace `v0.1.0` with your ref):

```bash
git archive --prefix=dahan-src/ -o /tmp/dahan.tar.gz v0.1.0
scp /tmp/dahan.tar.gz <initial-user>@<vps-ip>:/tmp/
shasum -a 256 /tmp/dahan.tar.gz                  # note this value
```

`git archive` packs only committed files: no `.env`, no databases, no `node_modules`.

**Step 3: install it** (server). First check the upload is intact: the checksum must equal the one from step 2, otherwise run `scp` again (a truncated file fails with `gzip: unexpected end of file`; also look at `df -h /tmp` for a full disk).

```bash
sha256sum /tmp/dahan.tar.gz
```

Then run the commands one after the other with `&&`, so a failure stops everything and nothing is deleted:

```bash
tar -xzf /tmp/dahan.tar.gz -C /tmp && \
sudo rsync -a --delete --chown=dahan:dahan \
  --exclude=/.env --exclude=/node_modules --exclude=/.next --exclude=/lib/generated \
  /tmp/dahan-src/ /opt/dahan/ && \
rm -rf /tmp/dahan-src /tmp/dahan.tar.gz
```

`rsync --delete` makes `/opt/dahan` match the new version exactly (files you deleted disappear). The `--exclude` lines keep what only exists on the server: `.env`, installed packages, the last build and the generated Prisma client.

**Step 4: check that the new version really landed.** Compare a checksum of the lockfile on both sides. The two lines must be identical:

```bash
git show v0.1.0:pnpm-lock.yaml | shasum -a 256                 # laptop (same ref as step 2)
sha256sum /opt/dahan/pnpm-lock.yaml                            # server
```

If they differ, stop and redo steps 2-3 before building: you would be building the old code. On an upgrade also confirm the settings file survived: `test -s /opt/dahan/.env && echo ".env present"`.

Then install the dependencies (first install only; on upgrades this is part of §9):

```bash
cd /opt/dahan
sudo -u dahan pnpm install --frozen-lockfile
```

The pnpm version is pinned by `"packageManager"` in `package.json`; corepack downloads exactly that version (answer `y` to the one-time download prompt). Without the pin, corepack fetches the newest pnpm, which reads settings from other places and fails with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` or `ERR_PNPM_IGNORED_BUILDS`. If you see either error, the fix is the pin, **not** `--no-frozen-lockfile` or `pnpm approve-builds`: those ignore the reviewed lockfile and skip the native builds (`bcrypt`, `better-sqlite3`) the app needs. Recover from such a run with:

```bash
sudo -u dahan rm -rf /opt/dahan/node_modules
```

then send the code again (steps 2-3 above, which restores the original `pnpm-lock.yaml`) and re-run the install.

`/opt/dahan/.env` (mode 600, owned by `dahan`, never committed):

```bash
DATABASE_URL="file:/var/lib/dahan/production.db"
AUTH_SECRET="<output of: openssl rand -base64 32>"
AUTH_TRUST_HOST="true"
# Optional: WhatsApp number the /daftar form hands visitors to (Indonesian format)
DAHAN_WHATSAPP="08xxxxxxxxxx"
# Optional: show the organization name on /login (only when exactly one organization exists)
LOGIN_SHOW_ORG_NAME="true"
```

```bash
sudo -u dahan chmod 600 /opt/dahan/.env
```

- Generate a fresh `AUTH_SECRET` for production; never reuse the development one.
- `DATABASE_URL` is an **absolute** path so the data lives outside the code directory.
- `AUTH_TRUST_HOST=true` is required behind Nginx.
- `DAHAN_WHATSAPP` (optional) is the contact number the public `/daftar` form sends visitors to (WhatsApp, with their details prefilled) after their submission is stored. It is read on the server at request time, so changing it needs only a service restart, not a rebuild. If unset or invalid, the submission is still stored and the visitor sees a confirmation without the WhatsApp link.
- `LOGIN_SHOW_ORG_NAME` (optional, default off) brings the organization name back on `/login` and in its page title. It applies only when exactly one organization exists; with two or more, or any value other than `true`, the login page stays generic (Dahan only). A deployment that ran as single-organization before this release shows the generic login until you set it.
- `NODE_ENV=production` is set by the systemd unit. Session cookies are `secure` and HSTS is sent only in production, so HTTPS must work (§6) before go-live.

Generate the Prisma client and apply migrations (use `migrate deploy`, never `migrate dev`):

```bash
cd /opt/dahan
sudo -u dahan pnpm prisma generate
sudo -u dahan pnpm prisma migrate deploy
```

`lib/generated/prisma` is not committed, so `prisma generate` is needed after every install.

### Create an organization and its first OWNER

Do **not** run `pnpm prisma db seed` in production (it creates fake sample data). Use `pnpm org:create` (`pnpm bootstrap` is an alias), which creates one organization, its levels, a root group and one OWNER. It works on an empty database and on one that already has organizations, so run it again for every additional organization:

```bash
sudo -u dahan bash -c 'umask 077 && cat > /tmp/bootstrap.env' <<'EOF'
BOOTSTRAP_ORG_NAME='Your Organization'
BOOTSTRAP_ROOT_GROUP_NAME='Pusat'
BOOTSTRAP_TIMEZONE='Asia/Jakarta'
BOOTSTRAP_OWNER_USERNAME='owner'
BOOTSTRAP_OWNER_NAME='Owner Full Name'
BOOTSTRAP_OWNER_PASSWORD='<strong password, min 8 chars>'
EOF
sudo -u dahan bash -c 'cd /opt/dahan && set -a && . ./.env && . /tmp/bootstrap.env && set +a && pnpm org:create; rm -f /tmp/bootstrap.env'
```

- **Load `.env` first** (the `. ./.env` part). `pnpm org:create`, `pnpm leads` and `pnpm reset-owner-password` do not read `.env` themselves; without `DATABASE_URL` they silently use an empty `prisma/dev.db` inside `/opt/dahan` and fail with `The table main.User does not exist`. If that happened, delete the stray file (`sudo -u dahan rm -f /opt/dahan/prisma/dev.db`), make sure the migrations in "Generate the Prisma client and apply migrations" ran against `/var/lib/dahan/production.db`, and repeat. Check with `sudo -u dahan sqlite3 /var/lib/dahan/production.db '.tables'`: it must list `User`, `Group`, `Member`, ...

- Keep the **single quotes** around every value. bash reads this file, so an unquoted value with a space breaks it: `BOOTSTRAP_OWNER_NAME=Owner Full Name` runs `Full` as a command and the script then reports a missing variable. A password must not itself contain a single quote. `umask 077` keeps the temporary file private to `dahan` while it holds the password.

- The script aborts, writing nothing, if the owner username is already taken by any organization (usernames are unique across all organizations and stored in lowercase), if the timezone is invalid or if the password is shorter than 8 characters. The password is never printed.
- `BOOTSTRAP_TIMEZONE` is optional: `Asia/Jakarta` (WIB, default), `Asia/Makassar` (WITA) or `Asia/Jayapura` (WIT). The OWNER can change it later under `/dashboard/pengaturan`.
- `BOOTSTRAP_LEVEL_NAMES` is optional (default `pusat,daerah,desa,kelompok`); the OWNER can rename levels later under `/dashboard/pengaturan`.
- The OWNER is created with `mustChangePassword = true` and must change it on first login (DESIGN.md §3.4).
- Creation is audited (`organization.create`, `user.create`, `actorId = null`).

### Interest sign-ups (`/daftar`)

The public `/daftar` form stores each submission as an interest lead (name, WhatsApp number, organization name, optional member count and message, consent timestamp, IP and user agent). Leads belong to no organization and have no web UI. List them on the server:

```bash
cd /opt/dahan
sudo -u dahan bash -c 'set -a && . ./.env && set +a && pnpm leads'                 # table, newest first (times in UTC)
sudo -u dahan bash -c 'set -a && . ./.env && set +a && pnpm leads --csv' > leads.csv
```

`pnpm leads` is read-only. The form is limited per client IP (see `INTEREST_RATE_LIMIT_*` in `lib/constants.ts`) using the `X-Forwarded-For` / `X-Real-IP` headers, which `deploy/nginx/dahan.conf` sets from `$remote_addr`; requests without either header share one global limit of the same size (so a bypass of nginx cannot flood the table, but real visitors would then block each other); do not remove those lines. Leads contain personal data: keep exports off shared drives and delete them when done.

### Build and start

```bash
cd /opt/dahan
sudo -u dahan pnpm build

sudo cp deploy/systemd/dahan.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dahan
sudo systemctl status dahan
curl -sI http://127.0.0.1:3000/login | head -1
```

If `which pnpm` is not `/usr/bin/pnpm`, edit `ExecStart` in the unit first.

## 5. Dependency audit gate

Run before every deploy and upgrade:

```bash
cd /opt/dahan && pnpm audit --prod
```

**Do not deploy** while it reports a high or critical advisory in a runtime package without a recorded exception below.

### Recorded exceptions

| Date | Advisory | Path | Reason accepted | Revisit |
|---|---|---|---|---|
| 2026-10-27 | 15 advisories (1 critical `proxy-addr`, 6 high: `@modelcontextprotocol/sdk`, `body-parser`, `undici`, `zod`; the rest moderate) | `shadcn` (devDependency, the component CLI) and its transitive packages | **Dev-only**, not part of `pnpm audit --prod`: the CLI is run by hand on a developer machine to add UI components and is not installed on the server. Fixing them would mean overriding about 20 transitive packages of a tool we do not ship. | On the next `shadcn` upgrade |

Fixed on 2026-10-27 (rows removed): `zod` (high, bumped to 4.6.7), `fast-uri` (override `>=3.1.9`), `mysql2` (gone with Prisma 7.10.1), and the dev-tool findings in `vite`, `@vitest/mocker` and `brace-expansion` (`vite` is now a direct devDependency; `brace-expansion` is pinned by overrides in `package.json`). Check `pnpm audit` (without `--prod`) for the full list; only the deploy gate above is blocking.

Re-run the audit at each upgrade and update this table; delete rows that are fixed.

## 6. Nginx and TLS

```bash
sudo cp /opt/dahan/deploy/nginx/dahan.conf /etc/nginx/sites-available/dahan.conf
sudo sed -i 's/dahan.example.com/dahan.example.org/g' /etc/nginx/sites-available/dahan.conf   # your domain
sudo rm -f /etc/nginx/sites-enabled/default
```

If the VPS has no IPv6, nginx refuses the `listen [::]` lines (`socket() [::]:80 failed (97: Address family not supported by protocol)`) and will not start. Check, and remove those lines if the check says so:

```bash
test -e /proc/net/if_inet6 && echo "IPv6 supported" || echo "no IPv6"
sudo sed -i '/listen \[::\]/d' /etc/nginx/sites-available/dahan.conf      # only when "no IPv6"
```

The config references certificates that do not exist yet, so nginx cannot start with it. Get the certificate first with certbot's own temporary web server (`--standalone`, port 80 must be free, so nginx is stopped), and only then enable the site. The two hooks are saved in certbot's renewal settings: before each renewal nginx is stopped (seconds of downtime) and afterwards started again with the new certificate.

```bash
sudo rm -f /etc/nginx/sites-enabled/dahan.conf        # must not be enabled yet
sudo systemctl stop nginx
sudo certbot certonly --standalone -d dahan.example.org \
  --pre-hook "systemctl stop nginx" --post-hook "systemctl start nginx"
sudo ln -sf /etc/nginx/sites-available/dahan.conf /etc/nginx/sites-enabled/dahan.conf
sudo nginx -t && sudo systemctl restart nginx
sudo certbot renew --dry-run                          # renewal works, nginx comes back
sudo systemctl list-timers | grep certbot             # auto-renew timer present
```

Before running certbot, `dig +short dahan.example.org` must print the VPS IP (§2.2) and port 80 must be open (§3). If you see `cannot load certificate ... fullchain.pem` from `nginx -t`, the site was enabled before the certificate existed: remove the link from `sites-enabled/` and start again from the first line.

Verify:

```bash
curl -I http://dahan.example.org/login          # 301 to https
curl -I https://dahan.example.org/login         # 200, with Content-Security-Policy and Strict-Transport-Security
```

Security headers come from the app. Do not add them in Nginx or they duplicate.

## 7. Backups

Daily at 02:00 Asia/Jakarta: online SQLite copy, integrity check, gzip, **age** encryption with a public key, upload to Object Storage. The server never holds the private key, so a compromised server cannot read backups.

### 7.1 Generate the age key (on your laptop, not the server)

```bash
age-keygen -o dahan-backup.age.key
```

- It prints the public recipient (`age1…`). That goes on the server.
- The file `dahan-backup.age.key` is the **private key**. Store it in your password manager **and** print a copy to keep offline. **If it is lost, every backup is unreadable.**
- Never copy it to the server except temporarily during a restore (§8).

### 7.2 Object Storage bucket and key

In the IDCloudHost console:

1. Create an Object Storage bucket (e.g. `dahan-backup-<random>`), private.
2. Create an access key **scoped to this bucket only**, if the console supports per-bucket keys. *Check in the console.*
3. Note the S3 endpoint and region. *Take them from the console; they are not hard-coded in this repo.*
4. Enable **versioning or object lock** if available, so a compromised server cannot silently delete backups. *Check in the console; if unavailable, note it as an accepted risk.*

### 7.3 Configure the server

```bash
# rclone remote "idch"
sudo -u dahan mkdir -p /home/dahan/.config/rclone
sudo -u dahan cp /opt/dahan/deploy/rclone.conf.example /home/dahan/.config/rclone/rclone.conf
sudo -u dahan chmod 600 /home/dahan/.config/rclone/rclone.conf
sudo -u dahan nano /home/dahan/.config/rclone/rclone.conf     # access key, secret, endpoint

# Backup settings
sudo cp /opt/dahan/deploy/env/backup.env.example /etc/dahan/backup.env
sudo chown dahan:dahan /etc/dahan/backup.env && sudo chmod 600 /etc/dahan/backup.env
sudo nano /etc/dahan/backup.env     # BACKUP_BUCKET, AGE_RECIPIENT (public), HEALTHCHECK_URL
```

The real `backup.env` and `rclone.conf` are git-ignored; only the `*.example` files are committed.

### 7.4 Alerting (healthchecks.io)

1. Create a free healthchecks.io check: period **1 day**, grace **2 hours**.
2. Add your email/phone as the notification channel.
3. Put its ping URL in `HEALTHCHECK_URL`.

The script pings `/fail` on any error, and a missed ping alerts via the grace period, so one check covers both "failed" and "never ran". Pings contain no PII.

### 7.5 Enable the timer

```bash
cd /opt/dahan
sudo cp deploy/systemd/dahan-backup.service deploy/systemd/dahan-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dahan-backup.timer
sudo systemctl start dahan-backup.service       # run once now
journalctl -u dahan-backup.service -n 30
rclone lsf idch:<bucket>/daily/ --config /home/dahan/.config/rclone/rclone.conf
```

Retention (done by the script): bucket keeps 30 days of `daily/` and 12 months of `monthly/` (first backup of each month); the server keeps the newest 7 locally in `/var/backups/dahan`.

## 8. Restore runbook

Use this for "database damaged" or "VPS lost". Time budget: under 1 hour.

**VPS lost:** redo §2–§6 on a new VPS (skip bootstrap), then restore below.

1. Copy the private key to the server temporarily:
   ```bash
   scp dahan-backup.age.key you@server:/tmp/dahan-restore.key
   ```
2. Restore (root; loads the bucket settings from `backup.env`):
   ```bash
   sudo bash -c 'set -a; . /etc/dahan/backup.env; set +a; \
     rclone --config /home/dahan/.config/rclone/rclone.conf lsf idch:$BACKUP_BUCKET/daily/ | tail -3'
   sudo bash -c 'set -a; . /etc/dahan/backup.env; set +a; export RCLONE_CONFIG=/home/dahan/.config/rclone/rclone.conf; \
     /opt/dahan/scripts/restore.sh daily/dahan-<YYYY-MM-DD>.db.gz.age /tmp/dahan-restore.key'
   ```
   A local file also works: `restore.sh /var/backups/dahan/dahan-<date>.db.gz.age /tmp/dahan-restore.key`.
3. Shred the key: `shred -u /tmp/dahan-restore.key`.
4. Log in and check recent data.

What the script does: decrypt → integrity check → stop service → keep the old DB as `production.db.pre-restore-<timestamp>` → install the restored file (mode 600, owner `dahan`) → start → request `/login`. A wrong key or a corrupt backup aborts **before** production is touched. Delete the `.pre-restore-*` file once you are sure.

### Drill log

Do a drill **at least once per quarter**: restore the latest bucket backup onto a scratch hourly VPS with the offline key, check login and recent data, then delete the VPS.

| Date | Backup restored | By | Result |
|---|---|---|---|
| _(pending first drill)_ | | | |

## 9. Upgrade procedure

Every release gets its own document in [docs/releases/](docs/releases/README.md), created from the template **before** deploying. It holds the release-specific risks, extra steps, and the sanity-check results; this section stays the generic procedure.

1. Run a fresh backup: `sudo systemctl start dahan-backup.service` and confirm it succeeded.
2. Take a **VPS snapshot** in the IDCloudHost console.
3. Send the new version to the server (§4, "Send the code"). The running app keeps serving the old build until step 5.
4. Run the audit gate (§5).
5. Deploy:
   ```bash
   cd /opt/dahan
   sudo -u dahan pnpm install --frozen-lockfile
   sudo -u dahan pnpm prisma generate
   sudo -u dahan pnpm prisma migrate deploy
   sudo -u dahan pnpm build
   sudo systemctl restart dahan
   ```
6. Check `curl -I https://<domain>/login` and log in.

**Rollback:** if a migration fails or the app misbehaves, restore the VPS snapshot, or run `scripts/restore.sh` with the pre-upgrade backup (§8) and redeploy the previous version by sending its tag the same way. New columns are ignored by older code.

## 10. Recovery: lost OWNER password

Run on the server as the `dahan` user. The temporary password is printed once; the account must change it at next login and all its sessions end.

```bash
cd /opt/dahan
sudo -u dahan bash -c 'set -a && . ./.env && set +a && pnpm reset-owner-password <username> [--activate]'
```

The action is audited with `actorId = null` and `meta.via = "cli"`. It exits non-zero for an unknown username.

## 11. Go-live checklist

- [ ] `AUTH_SECRET` is unique to production
- [ ] `.env` mode 600, DB in `/var/lib/dahan` (mode 700)
- [ ] `pnpm audit --prod` clean or exceptions recorded in §5
- [ ] From outside: port 3000 refused; `http://` redirects to `https://`
- [ ] `curl -I https://<domain>/login` shows CSP and HSTS
- [ ] Password SSH login refused; root SSH login refused
- [ ] `sudo ufw status verbose`: active, `deny (incoming)`, only 22 (LIMIT), 80, 443, each for IPv4 and `(v6)`
- [ ] `nc -zv -w3 <server-ip> 3000` from outside fails; 80 and 443 answer
- [ ] Cloud-level firewall (if the plan has one) allows the same three ports only, or its absence is noted as accepted
- [ ] VPS web console access tested (recovery path if the firewall locks you out)
- [ ] Every organization's OWNER changed the bootstrap password after first login
- [ ] `LOGIN_SHOW_ORG_NAME` set only if this deployment hosts exactly one organization and you want its name on `/login`
- [ ] `pnpm prisma db seed` was **never** run against this database
- [ ] Backup timer enabled; `daily/` and `monthly/` objects exist; healthchecks.io shows success
- [ ] A failed backup (e.g. wrong endpoint) triggers an alert
- [ ] `age` private key stored in password manager **and** printed copy
- [ ] At least one restore drill passed and is logged in §8, **before** real data is entered
- [ ] Users were told they must log in again once after this deploy (sessions without `sessionVersion` are ended)
