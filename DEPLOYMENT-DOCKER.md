# Deployment with Docker

The app runs as one container (`compose.yaml`, `Dockerfile`). Everything else in [DEPLOYMENT.md](DEPLOYMENT.md) stays the same: VPS ordering and hardening (§2-3), Nginx and TLS (§6), backups (§7), restore (§8). Only §4 (install), §9 (upgrade) and §10 (password reset) change; this page replaces them. Skip the Node, pnpm and `dahan.service` steps: the image carries Node 24 and pnpm, and Docker restarts the container itself.

The container listens on `127.0.0.1:3000`, so Nginx proxies to it exactly as before. The database stays on the host in `/var/lib/dahan/production.db` (mounted at `/data`), which is why `scripts/backup.sh` and `restore.sh` keep working unchanged.

## First install

1. Install Docker Engine with the compose plugin ([docs.docker.com/engine/install](https://docs.docker.com/engine/install/ubuntu/)). Docker edits the firewall itself for published ports, but this one is published on `127.0.0.1` only, so it is not reachable from outside.
2. Create the directories and `dahan` user as in DEPLOYMENT.md §3-4 (`/opt/dahan`, `/var/lib/dahan` mode 700), then send the code the same way (§4 "Send the code").
3. Create `/opt/dahan/.env` (mode 600, owner `dahan`):
   ```bash
   AUTH_SECRET="<output of: openssl rand -base64 32>"
   AUTH_TRUST_HOST="true"
   APP_UID=<output of: id -u dahan>
   APP_GID=<output of: id -g dahan>
   ```
   Add the optional variables from DEPLOYMENT.md §4 if you use them. `DATABASE_URL` is set by `compose.yaml`; do not put it here.
4. Build and start:
   ```bash
   cd /opt/dahan
   sudo docker compose up -d --build
   sudo docker compose ps                  # State: running, Health: healthy
   curl -sI http://127.0.0.1:3000/login | head -1
   ```
   Pending migrations run automatically at every start (`deploy/docker/entrypoint.sh`), so there is no separate migrate step.
5. First organization and OWNER (the temporary file keeps the password out of your shell history):
   ```bash
   sudo -u dahan bash -c 'umask 077 && cat > /tmp/bootstrap.env' <<'EOF'
   BOOTSTRAP_ORG_NAME='Your Organization'
   BOOTSTRAP_ROOT_GROUP_NAME='Pusat'
   BOOTSTRAP_OWNER_USERNAME='owner'
   BOOTSTRAP_OWNER_NAME='Owner Full Name'
   BOOTSTRAP_OWNER_PASSWORD='<strong password, min 8 chars>'
   EOF
   sudo docker compose exec -T app sh -c 'set -a && . /dev/stdin && set +a && pnpm org:create' < /tmp/bootstrap.env; rm -f /tmp/bootstrap.env
   ```
   The same rules as DEPLOYMENT.md §4 apply (single quotes, optional `BOOTSTRAP_TIMEZONE` and `BOOTSTRAP_LEVEL_NAMES`). Because the image sets `DATABASE_URL`, you no longer need to load `.env` before the CLIs.

## Upgrade (replaces §9 step 5)

Steps 1-4 of §9 are unchanged (backup, snapshot, send the new code, audit gate; run the audit on your laptop or with `pnpm audit` before sending, since the server has no pnpm). Then:

```bash
cd /opt/dahan
sudo docker compose up -d --build
sudo docker compose logs --tail 30 app     # "migrations ... applied", then "Ready"
curl -I https://<domain>/login
```

The old container keeps serving until the new image is built; the switch takes a few seconds. Rollback is as in §9: restore the snapshot or backup and send the previous tag.

## Operating

```bash
sudo docker compose logs -f app                                            # logs
sudo docker compose restart app
sudo docker compose exec app pnpm leads [--csv]                            # interest sign-ups (read-only)
sudo docker compose exec app pnpm reset-owner-password <username> [--activate]   # DEPLOYMENT.md §10
sudo docker compose exec app sqlite3 /data/production.db '.tables'
```

Old images pile up: `sudo docker image prune -f` after a successful upgrade.

## Notes

- The container runs as the host `dahan` uid with a read-only root filesystem, no capabilities and `no-new-privileges`. Only `/data` is writable.
- Migrating an existing systemd install: [docs/migrate-to-docker.md](docs/migrate-to-docker.md).
- Building needs about 2 GB of RAM; the swap file from DEPLOYMENT.md §3 covers that.
