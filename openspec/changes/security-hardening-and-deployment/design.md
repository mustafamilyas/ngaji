# Design

## Context

See proposal.md — Why. Constraints:

- SQLite file DB, single long-running Node process (DESIGN.md §8). That single-process guarantee is what makes in-memory locks in Decision 2 valid.
- Auth.js v5 JWT sessions; the `jwt` callback already re-reads the user on every request (DESIGN.md §4.1), so session revocation can be added there for no extra query.
- Server Actions are dispatched by the `Next-Action` header, not by URL, so `proxy.ts` path rules cannot protect them.
- Hosting is IDCloudHost: Cloud VPS (KVM, NVMe, hourly/monthly billing, snapshots, Jakarta/Bogor data centers) plus S3-compatible Object Storage (about Rp 500/GB). Its exact S3 endpoint and key-scoping features are confirmed from the console at setup time (Open Questions).

## Goals / Non-Goals

**Goals:**
- Close every High/Medium finding from the 2026-10-10 review with a test that would have caught it.
- A production setup that one person can rebuild from DEPLOYMENT.md plus the `deploy/` and `scripts/` directories.
- RPO ≤ 24 h, RTO ≤ 1 h for "VPS lost", with backups unreadable to anyone who compromises the server.

**Non-Goals:**
- High availability, multiple instances, or moving off SQLite.
- Audit-log PII retention or erasure, kiosk-mode check-in, peer-OWNER deactivate/demote rules (listed as follow-ups in the proposal).
- CI pipeline: `pnpm audit` is run manually in the deploy runbook until CI exists.

## Decisions

### 1. Client IP: proxy overwrites, app takes the last hop
Nginx sets `X-Forwarded-For $remote_addr` and `X-Real-IP $remote_addr` (overwrite, not `$proxy_add_x_forwarded_for`). `getClientIp` reads the **last** `X-Forwarded-For` entry. With the shipped config there is only one entry. If someone later switches Nginx back to "append", the last entry is still the one Nginx added, so the app stays safe either way. The app binds `127.0.0.1`, so nobody can reach it without going through Nginx.
*Alternative:* a `TRUSTED_PROXY_HOPS` setting. Rejected as more configuration with no benefit for a single fixed proxy. If Cloudflare is put in front later, this decision has to be revisited (`CF-Connecting-IP` + Nginx `real_ip` module).

### 2. Rate limit: normalize once, serialize per key, count in SQL
- `credentialsSchema` parses first. The parsed (trimmed) username drives the lookup, the limiter and the audit row, which removes the mismatch between `extractUsername` and the stored value. Invalid input is counted under IP only.
- An in-process keyed mutex (`Map<string, Promise>`) wraps "check → verify → audit" for the keys `u:<username>` and `ip:<ip>`, taking locks in sorted order to avoid deadlock. Because there is one process, this fully closes the parallel-burst race. *Alternative:* insert a provisional "attempt" row before bcrypt. Rejected: it needs a schema change and a cleanup step.
- Counting moves into SQLite: `count()` by `ip`, and `$queryRaw` with `json_extract(meta,'$.username')` for the username, both on a new `@@index([action, createdAt])`. This replaces loading every failure row into memory.
- The change-password path reuses the same limiter keyed by `u:<username>`, auditing failures as `auth.login_failed` with `meta.reason = "change_password"`.

### 3. Timing: dummy hash
A module-level bcrypt hash of a random string (cost 12, computed once at startup) is compared whenever the user is unknown or inactive.

### 4. Session revocation: `User.sessionVersion`
- An integer column with default 0. It is copied into the JWT at sign-in and compared in `revalidateSessionUser`; a mismatch returns `null`, which ends the session.
- It is incremented in the same transaction as `user.change_password`, `user.reset_password` and the CLI reset.
- The `jwt` callback never takes `sessionVersion` from `trigger === "update"` input, so a stolen session can't adopt the new version.
- After an own-password change the action calls `signOut({ redirectTo: "/login?pesan=password-diubah" })`.
*Alternative:* `passwordChangedAt` timestamp vs `iat`. Rejected because of clock and timestamp-granularity edge cases. Database sessions were also rejected: too big a change for the MVP.

### 5. One `requireSession()` for all actions
`lib/auth/require-session.ts` exports `requireSession({ allowPasswordChange?: boolean })`. It redirects to `/login` when there is no session and throws `ForbiddenError` when `mustChangePassword` is set and `allowPasswordChange` is not. Every `app/**/actions.ts` drops its local copy. Only `changePasswordAction` and `signOutAction` opt in. A test enumerates the exported actions to make sure none bypass the helper.

### 6. DTOs at the action boundary
`lib/user/dto.ts#toUserDto` returns `{ id, username, name, isActive, mustChangePassword }`. `createUser`/`setUserActive` return DTOs. A test serializes each user action's result and asserts that no key starts with `password`.

### 7. Root-OWNER invariant checked after the write
Inside each `setUserActive` / `updateUserRole` / `moveUser` transaction: perform the update, then count active OWNERs of the root group. If the count is 0, throw `ForbiddenError`, which rolls back. SQLite serializes write transactions, so the second of two concurrent requests sees the first one's commit. This replaces the pre-check (`isLastActiveRootOwner`) and also covers self-move.

### 8. Peer-OWNER reset
For `user.resetPassword`, when the target role is OWNER, the target group path must be strictly below the caller's (`isAncestorOf(session.groupPath, target.groupPath)`). Root recovery goes through `scripts/reset-owner-password.ts` (tsx; run as the `ngaji` user on the server).

### 9. Headers
Add `base-uri 'none'; object-src 'none'; form-action 'self'` to `buildCsp`. HSTS moves from `next.config.ts` into a production-only branch. Nginx does not add duplicate security headers.

### 10. Reference infrastructure (IDCloudHost)

| Item | Choice | Why |
|---|---|---|
| VPS | Cloud VPS, **2 vCPU / 2 GB RAM / 40 GB NVMe**, Jakarta, Ubuntu 24.04 LTS (~Rp 90–150k/month) | Next build needs about 1.5 GB; the DB is MBs; 40 GB holds 7 local backups and logs comfortably |
| Swap | 2 GB swapfile | Keeps `pnpm build` from OOM-killing on 2 GB |
| Firewall | IDCloudHost network firewall (if offered on the plan) **and** `ufw`: allow 22, 80, 443 | Belt and braces; the app port is closed either way |
| SSH | key-only, `PermitRootLogin no`, `fail2ban` sshd jail | Brute-force noise |
| Patching | `unattended-upgrades` (security only), monthly reboot window | |
| TLS | Nginx + certbot (Let's Encrypt), auto-renew timer | |
| Time | `timedatectl set-timezone Asia/Jakarta` | Cron and timers line up with the app's day boundary |
| Runtime | Node 24 LTS via NodeSource, pnpm via corepack, systemd `ngaji.service` with `ExecStart=pnpm start -H 127.0.0.1 -p 3000` and hardening (`ProtectSystem=strict`, `ReadWritePaths=/var/lib/ngaji /var/backups/ngaji`, `NoNewPrivileges`, `PrivateTmp`) | |
| Data | `/var/lib/ngaji/production.db`, dir mode 700, owner `ngaji` | |

### 11. Backup pipeline (`scripts/backup.sh`, systemd timer)
1. `sqlite3 production.db ".backup /var/backups/ngaji/tmp.db"`. This uses SQLite's online backup API, so the copy is consistent while the app keeps writing. `.backup` was chosen over `VACUUM INTO` because the `sqlite3` CLI is standard.
2. `PRAGMA integrity_check` must return `ok`, or the run aborts.
3. `gzip -9` → `age -r <public key>` → `ngaji-YYYY-MM-DD.db.gz.age`. The plaintext temp file is deleted (`trap`).
4. `rclone copyto` to `idch:<bucket>/daily/`. If the current month has no object under `monthly/`, the run also writes `monthly/ngaji-YYYY-MM.db.gz.age`.
5. Prune: `rclone delete --min-age 30d idch:<bucket>/daily/` and `--min-age 365d .../monthly/`; local copies beyond the newest 7 are deleted.
6. Ping the healthcheck URL: `/fail` on any error (via `trap ERR`), plain URL on success.

- **Schedule:** a `ngaji-backup.timer` with `OnCalendar=*-*-* 02:00 Asia/Jakarta` and `Persistent=true`. It runs as `ngaji`, and its environment comes from `/etc/ngaji/backup.env` (mode 600): `BACKUP_BUCKET`, `AGE_RECIPIENT`, `HEALTHCHECK_URL`. The rclone config lives in `~ngaji/.config/rclone/rclone.conf` (mode 600), using `provider = Other` and the endpoint from the IDCloudHost console.
- **Encryption:** `age` was chosen over gpg because it is simpler and has a public-key-only mode. The private key is generated on the owner's laptop and stored in their password manager, with a printed copy offline. Only the public recipient string goes to the server.
- **Alerting:** healthchecks.io, free tier, with a 1-day period and a 2-hour grace. One check covers both "failed" and "missed" runs. The pings contain no PII. *Alternative:* msmtp email. Rejected because it can't alert on runs that never happened.

### 12. Restore (`scripts/restore.sh`) and drills
- **Restore steps:** `restore.sh <object|file> <identity-file>`.
  1. Decrypt and gunzip to a temp file.
  2. Run the integrity check.
  3. `systemctl stop ngaji`.
  4. Move the current DB to `production.db.pre-restore-<ts>`, removing stale `-wal`/`-shm`.
  5. Install the restored file with owner `ngaji` and mode 600.
  6. Start the service and curl `/login`.
- The identity file is copied to the server only for the duration of the restore and then shredded.
- **Quarterly drill:** run the same steps on an hourly-billed scratch VPS, then delete that VPS. Record the date in DEPLOYMENT.md §Drills.

## Risks / Trade-offs

- [Bucket credentials on a compromised server can delete backups] → Use a key scoped to the backup bucket. Enable bucket versioning or object lock if IDCloudHost offers it. The quarterly drill also leaves a recent decrypted-then-re-encrypted copy on the owner's machine.
- [Lost `age` private key = all backups useless] → Two offline copies (password manager + printed). The drill proves the key still works.
- [Forcing re-login after a password change annoys first-time users] → Accepted. The `/login` banner explains why ("Password berhasil diubah, silakan masuk lagi").
- [The in-memory limiter mutex assumes one process] → That assumption is already required by SQLite (DESIGN.md §8) and is stated in DEPLOYMENT.md. A multi-process setup would need a DB-backed lock.
- [Both data centers belong to one provider] → Accepted by the owner. A second provider can be added to the rclone config later without code changes.
- [`next` upgrade regressions] → Upgrade first as its own commit and run the full test suite plus a manual smoke test before the other changes.

## Migration Plan

1. Merge the code changes. The Prisma migration adds `User.sessionVersion` (default 0) and the `AuditLog(action, createdAt)` index. Both are additive and backfill nothing.
2. Existing sessions carry no `sessionVersion`. The callback treats a missing value as a mismatch, so every user logs in once after deploy. Announce this beforehand.
3. First deploy follows the new DEPLOYMENT.md from scratch. The backup timer is enabled before go-live, and one manual restore drill passes before real data is entered.
4. Rollback: restore the VPS snapshot taken before the upgrade, or redeploy the previous commit. The new column is ignored by old code.

## Open Questions

- The exact IDCloudHost Object Storage endpoint and region string, and whether it supports per-bucket access keys, versioning or object lock. These are confirmed from the console during setup; the pipeline doesn't change, only the rclone config and the hardening note.
- Whether the chosen VPS plan includes IDCloudHost's network firewall. `ufw` is enough on its own.
