# Migrating a running server from systemd to Docker

For a server set up with [DEPLOYMENT.md](../DEPLOYMENT.md) (Node, pnpm and `dahan.service` on the VPS) that should now run the app as a container ([DEPLOYMENT-DOCKER.md](../DEPLOYMENT-DOCKER.md)). Nginx, TLS, the `dahan` user, the database file and the backup timer stay exactly as they are; only the process that serves port 3000 changes. Expect a few minutes of downtime (stop the service, build, start).

What carries over unchanged:

| Item | Why it still works |
|---|---|
| `/var/lib/dahan/production.db` | Mounted into the container as `/data`; same file, same owner. |
| `/opt/dahan/.env` | Read by compose (`env_file`). The `DATABASE_URL` line in it is harmless: `compose.yaml` overrides it with the container path. Leave it, so a rollback needs no edit. |
| Nginx (`127.0.0.1:3000`) | The container publishes the same address. |
| `dahan-backup.timer`, `scripts/backup.sh`, `restore.sh` | They read the database file on the host as `dahan`; the container runs as the same uid. |

## 1. Prepare (service still running)

1. Take a fresh backup and confirm it succeeded:
   ```bash
   sudo systemctl start dahan-backup.service
   sudo systemctl status dahan-backup.service --no-pager | head -5
   ```
2. Take a **VPS snapshot** in the IDCloudHost console. It is the rollback of last resort.
3. Install Docker Engine with the compose plugin ([docs.docker.com/engine/install](https://docs.docker.com/engine/install/ubuntu/)) and check it:
   ```bash
   sudo docker --version && sudo docker compose version
   ```
4. Send the version that contains `Dockerfile` and `compose.yaml` to `/opt/dahan` (DEPLOYMENT.md §4 "Send the code", steps 2-3). The running app is not affected: it keeps using the old `.next` build until you stop it.
5. Add the uid and gid of the `dahan` user to `.env`:
   ```bash
   echo "APP_UID=$(id -u dahan)" | sudo tee -a /opt/dahan/.env
   echo "APP_GID=$(id -g dahan)" | sudo tee -a /opt/dahan/.env
   sudo -u dahan cp /opt/dahan/.env /opt/dahan/.env.pre-docker      # rollback copy, mode stays 600
   ```
6. Build the image while the old service still serves traffic (the longest step, about 2 GB of RAM; the swap from §3 covers it):
   ```bash
   cd /opt/dahan
   sudo docker compose build
   ```

## 2. Switch

```bash
sudo systemctl stop dahan
sudo systemctl disable dahan          # so it does not start again after a reboot
sudo -u dahan sqlite3 /var/lib/dahan/production.db 'PRAGMA wal_checkpoint(TRUNCATE);'   # optional: folds the WAL into the main file
cd /opt/dahan
sudo docker compose up -d
```

Starting the container applies pending migrations (`deploy/docker/entrypoint.sh`). If the version you send is newer than the one running, its new migrations run now (for example `member_phone_optional` rebuilds the `Member` table); the backup from step 1 is what protects you if one fails.

## 3. Verify

```bash
sudo docker compose ps                                  # Health: healthy (up to ~30 s)
sudo docker compose logs --tail 30 app                  # migrations applied, "Ready"
curl -sI http://127.0.0.1:3000/login | head -1          # HTTP/1.1 200 OK
curl -sI https://<domain>/login | head -1               # through nginx
ls -l /var/lib/dahan/production.db                      # owner is still dahan
```

Then log in and open a member and an attendance page. Finally confirm the backup path still works against the live database:

```bash
sudo systemctl start dahan-backup.service && sudo systemctl status dahan-backup.service --no-pager | head -5
```

Check the reboot behavior once: `sudo reboot`, then after it comes back `sudo docker compose ps` in `/opt/dahan` must show the app running (`restart: unless-stopped` plus the enabled Docker service does this).

## 4. Rollback

Within the same session, if anything is wrong:

```bash
cd /opt/dahan
sudo docker compose down
sudo systemctl enable --now dahan
curl -sI http://127.0.0.1:3000/login | head -1
```

The old build in `/opt/dahan/.next` and `node_modules` were never touched. If a new migration already ran, redeploy the matching older code or restore the backup: older code is not guaranteed to work against a newer schema. If the database itself is damaged, restore the backup from step 1 with `scripts/restore.sh` (DEPLOYMENT.md §8) or the VPS snapshot.

## 5. Clean up (after a few days of stable running)

```bash
sudo rm -f /opt/dahan/.env.pre-docker
sudo -u dahan rm -rf /opt/dahan/node_modules /opt/dahan/.next     # no longer used; the image has its own
sudo rm -f /etc/systemd/system/dahan.service && sudo systemctl daemon-reload
sudo docker image prune -f
```

Remove `node_modules` and `.next` only when you will not roll back. From now on upgrade with DEPLOYMENT-DOCKER.md ("Upgrade"); the `rsync` in DEPLOYMENT.md §4 can keep its `--exclude` lines, they are harmless. `pnpm` is no longer needed on the server: `leads` and `reset-owner-password` run as `sudo docker compose exec app pnpm ...`.

## Common problems

| Symptom | Cause and fix |
|---|---|
| `unable to open database file` in the logs | `/var/lib/dahan` is not writable for `APP_UID`. Check `id dahan` against `.env` and `ls -ld /var/lib/dahan` (owner `dahan`, mode 700). |
| `address already in use` on `up` | The old service still holds port 3000: `sudo systemctl stop dahan`. |
| Build is killed (`exit code 137`) | Out of memory: confirm the swap from DEPLOYMENT.md §3 (`swapon --show`). |
| Health stays `starting`/`unhealthy` | Read `docker compose logs app`; a missing `AUTH_SECRET` in `.env` is the usual cause. |
| Login loops or cookies are rejected | `AUTH_TRUST_HOST="true"` missing from `.env`, or nginx not sending `X-Forwarded-*` (see `deploy/nginx/dahan.conf`). |
