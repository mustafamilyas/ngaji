# Migrating a running server from systemd to Docker

For a server set up with [DEPLOYMENT.md](../DEPLOYMENT.md) (Node, pnpm and `dahan.service` on the VPS) that should now run the app as a container ([DEPLOYMENT-DOCKER.md](../DEPLOYMENT-DOCKER.md)). Nginx, TLS, the `dahan` user, the database file and the backup timer stay exactly as they are; only the process that serves port 3000 changes. Expect a few minutes of downtime (stop the service, start the container).

Follow the steps in order, top to bottom. Each command says where it runs: **laptop** (in the repository) or **server** (SSH session on the VPS). Replace `<vps-ip>`, `<initial-user>`, `<domain>` and the tag `v0.1.0` with your own values.

What carries over unchanged:

| Item | Why it still works |
|---|---|
| `/var/lib/dahan/production.db` | Mounted into the container as `/data`; same file, same owner. |
| `/opt/dahan/.env` | Read by compose (`env_file`). The `DATABASE_URL` line in it is harmless: `compose.yaml` overrides it with the container path. Leave it, so a rollback needs no edit. |
| Nginx (`127.0.0.1:3000`) | The container publishes the same address. |
| `dahan-backup.timer`, `scripts/backup.sh` | They read the database file on the host as `dahan`; the container runs as the same uid. |

What does **not** carry over: `scripts/restore.sh` starts and stops the systemd unit `dahan`. After this migration, restore with the Docker variant in step 6.

## 1. Prepare (old service keeps serving)

**1.1 Backup (skip while there is no real data)**

If nobody uses the app yet and the database holds no data worth keeping, skip the backup and the snapshot and go to 1.2: a failed migration then costs only a re-run of `pnpm org:create` (DEPLOYMENT-DOCKER.md, First install step 5). Once real members exist, do this step first: run `dahan-backup.service` if DEPLOYMENT.md §7 is set up, otherwise take a manual `sqlite3 ... ".backup ..."` copy, and always take a **VPS snapshot** in the IDCloudHost console.


**1.2 Install Docker Engine** (server; official apt repository, Ubuntu 24.04)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker --version && sudo docker compose version                # both print a version
```

Do not add the `dahan` or your own user to the `docker` group; always use `sudo docker ...`. Docker publishes ports around `ufw`, but `compose.yaml` binds only `127.0.0.1:3000`, so nothing new is reachable from outside. Verify after step 3 with `nc -zv -w3 <vps-ip> 3000` from your laptop (must fail).

**1.3 Send the version that contains `Dockerfile` and `compose.yaml`** (laptop)

```bash
git status --short                      # must print nothing; commit first
git tag v0.1.4                          # skip if the tag exists; or use HEAD below instead of the tag
rm -f /tmp/dahan.tar.gz                 # never reuse an archive from an earlier run
git archive --prefix=dahan-src/ -o /tmp/dahan.tar.gz v0.1.4
tar -tzf /tmp/dahan.tar.gz | grep -E '^dahan-src/(Dockerfile|compose.yaml)$'     # must print BOTH lines; if not, stop
scp /tmp/dahan.tar.gz ilyasmustafa@103.174.114.132:/tmp/
shasum -a 256 /tmp/dahan.tar.gz         # note this value
git show v0.1.4:pnpm-lock.yaml | shasum -a 256     # note this too, used in the check below
```

**1.4 Install it into `/opt/dahan`** (server). The first checksum must equal the one from the laptop, otherwise run `scp` again.

```bash
sha256sum /tmp/dahan.tar.gz
tar -xzf /tmp/dahan.tar.gz -C /tmp && \
sudo rsync -a --delete --chown=dahan:dahan \
  --exclude=/.env --exclude=/node_modules --exclude=/.next --exclude=/lib/generated \
  /tmp/dahan-src/ /opt/dahan/ && \
rm -rf /tmp/dahan-src /tmp/dahan.tar.gz
```

Check that the new version landed (server). The output must equal the lockfile checksum from the laptop, and `Dockerfile`, `compose.yaml` and `.env` must all exist:

```bash
sha256sum /opt/dahan/pnpm-lock.yaml
ls -l /opt/dahan/Dockerfile /opt/dahan/compose.yaml /opt/dahan/deploy/docker/entrypoint.sh
sudo test -s /opt/dahan/.env && echo ".env present"
```

The running app is not affected: it keeps using its old `.next` build until you stop it.

**1.5 Add the uid and gid of `dahan` to `.env`** (server). Run this once only; running it twice adds duplicate lines.

```bash
grep -q '^APP_UID=' /opt/dahan/.env && echo "ALREADY SET, skip" || {
  echo "APP_UID=$(id -u dahan)" | sudo tee -a /opt/dahan/.env
  echo "APP_GID=$(id -g dahan)" | sudo tee -a /opt/dahan/.env
}
sudo cp -p /opt/dahan/.env /opt/dahan/.env.pre-docker                 # rollback copy, same owner and mode
sudo grep -E '^(APP_UID|APP_GID|AUTH_SECRET|AUTH_TRUST_HOST)=' /opt/dahan/.env | sed 's/^\(AUTH_SECRET=\).*/\1<hidden>/'
```

The last command must show `APP_UID`, `APP_GID`, `AUTH_SECRET=<hidden>` and `AUTH_TRUST_HOST="true"`. If `AUTH_TRUST_HOST` is missing, add `AUTH_TRUST_HOST="true"` to `/opt/dahan/.env`.

**1.6 Build the image** (server, old service still serving; the longest step, about 2 GB of RAM, a few minutes)

```bash
swapon --show                           # must list /swapfile (DEPLOYMENT.md §3); otherwise the build may be killed
cd /opt/dahan
sudo docker compose build
sudo docker images dahan                # dahan:latest is listed
```

## 2. Switch

Run all of it in one SSH session, in this order (server):

```bash
sudo systemctl stop dahan
sudo systemctl disable dahan                    # so it does not start again after a reboot
sudo -u dahan sqlite3 /var/lib/dahan/production.db 'PRAGMA wal_checkpoint(TRUNCATE);'   # optional: folds the WAL into the main file; prints "0|0|0"
cd /opt/dahan
sudo docker compose up -d
```

Starting the container applies pending migrations (`deploy/docker/entrypoint.sh`). If the version you sent is newer than the one running, its new migrations run now (for example `member_phone_optional` rebuilds the `Member` table); the backup and snapshot from step 1.1 are what protect you if one fails.

## 3. Verify

```bash
cd /opt/dahan
sudo docker compose ps                                  # STATUS "Up ... (healthy)" (can take ~30 s; repeat until healthy)
sudo docker compose logs --tail 30 app                  # migrations applied (or "No pending migrations"), then "Ready"
curl -sI http://127.0.0.1:3000/login | head -1          # HTTP/1.1 200 OK
curl -sI https://<domain>/login | head -1               # HTTP/2 200, through nginx
ls -l /var/lib/dahan/production.db                      # owner is still dahan
```

From your **laptop**: `nc -zv -w3 <vps-ip> 3000` must fail (port closed to the outside).

In the browser: log in, open a member and an attendance page. If you set up backups (DEPLOYMENT.md §7), confirm the backup path works against the live database (server):

```bash
sudo systemctl start dahan-backup.service && sudo systemctl status dahan-backup.service --no-pager | head -5
```

Check the reboot behavior once (server): `sudo reboot`, wait a minute, SSH back in, then:

```bash
cd /opt/dahan && sudo docker compose ps          # app is Up (healthy) without you starting anything
systemctl is-enabled dahan                       # "disabled"
```

## 4. Rollback

Within the same session, if anything is wrong (server):

```bash
cd /opt/dahan
sudo docker compose down
sudo systemctl enable --now dahan
curl -sI http://127.0.0.1:3000/login | head -1
```

The old build in `/opt/dahan/.next` and `node_modules` were never touched. If a new migration already ran, redeploy the matching older code or restore the backup: older code is not guaranteed to work against a newer schema. If the database itself is damaged, restore the backup from step 1.1 (step 6 below) or the VPS snapshot.

## 5. Clean up (after a few days of stable running)

Do this only when you will not roll back (server):

```bash
sudo rm -f /opt/dahan/.env.pre-docker
sudo -u dahan rm -rf /opt/dahan/node_modules /opt/dahan/.next     # no longer used; the image has its own
sudo rm -f /etc/systemd/system/dahan.service && sudo systemctl daemon-reload
sudo docker image prune -f
```

From now on upgrade with DEPLOYMENT-DOCKER.md ("Upgrade"); the `rsync` in DEPLOYMENT.md §4 can keep its `--exclude` lines, they are harmless. `pnpm` is no longer needed on the server: `leads` and `reset-owner-password` run as `sudo docker compose exec app pnpm ...`.

## 6. Restore a backup on the Docker setup

DEPLOYMENT.md §8 is unchanged except that `restore.sh` must not touch systemd. Stop the container yourself, run the script with `SKIP_SERVICE=1`, start the container, then check (server; `<file>` is the backup object or local file as in §8, the key was copied to `/tmp/dahan-restore.key`):

```bash
cd /opt/dahan
sudo docker compose stop app
sudo bash -c 'set -a; . /etc/dahan/backup.env; set +a; export RCLONE_CONFIG=/home/dahan/.config/rclone/rclone.conf; \
  SKIP_SERVICE=1 /opt/dahan/scripts/restore.sh <file> /tmp/dahan-restore.key'
sudo docker compose up -d
curl -sI http://127.0.0.1:3000/login | head -1
shred -u /tmp/dahan-restore.key
```

Without `SKIP_SERVICE=1` the script would run `systemctl start dahan`, which starts the old process next to the container (or fails once `dahan.service` is removed).

## Common problems

| Symptom | Cause and fix |
|---|---|
| `unable to open database file` in the logs | `/var/lib/dahan` is not writable for `APP_UID`. Check `id dahan` against `.env` and `ls -ld /var/lib/dahan` (owner `dahan`, mode 700). |
| `address already in use` on `up` | The old service still holds port 3000: `sudo systemctl stop dahan`. |
| Build is killed (`exit code 137`) | Out of memory: confirm the swap from DEPLOYMENT.md §3 (`swapon --show`). |
| Health stays `starting`/`unhealthy` | Read `docker compose logs app`; a missing `AUTH_SECRET` in `.env` is the usual cause. |
| Login loops or cookies are rejected | `AUTH_TRUST_HOST="true"` missing from `.env`, or nginx not sending `X-Forwarded-*` (see `deploy/nginx/dahan.conf`). |
| `docker compose` says `no configuration file provided` | You are not in `/opt/dahan`: `cd /opt/dahan` first. |
