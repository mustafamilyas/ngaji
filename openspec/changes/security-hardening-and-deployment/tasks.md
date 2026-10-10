# Tasks

## 1. Dependencies (own commit, first)

- [x] 1.1 Upgrade `next` + `eslint-config-next` to ≥ 16.3.8, move `shadcn` to devDependencies; verify `pnpm audit --prod` has no high/critical in runtime packages (record any remaining tooling-only exceptions in DEPLOYMENT.md) and `pnpm test` + `pnpm tsc --noEmit` pass
- [x] 1.2 Smoke-test login, member list, attendance save on `pnpm build && pnpm start`; verify no CSP console errors

## 2. Schema

- [x] 2.1 Migration: `User.sessionVersion Int @default(0)` and `AuditLog @@index([action, createdAt])` (the index already existed in the init migration); verify `pnpm prisma migrate dev` applies cleanly on a copy of `dev.db` and seed still runs

## 3. Pure logic first (tests before code)

- [x] 3.1 `lib/http.ts#getClientIp` takes the last `X-Forwarded-For` hop, falls back to `X-Real-IP`; verify unit tests for single, multi-hop and spoofed-first-hop headers
- [x] 3.2 Keyed mutex `lib/auth/keyed-lock.ts` (sorted multi-key acquire); verify tests show same-key calls serialize and different keys run concurrently
- [x] 3.3 `isDateString` moved to `lib/dates.ts` with 1900–2100 bound; shared `dateSchema` in `lib/validation/common.ts`; verify tests for `2026-02-30`, `2026-99-99`, `0001-01-01`, `2028-02-29`
- [x] 3.4 `authorize("user.resetPassword")`: OWNER→OWNER only strictly below; verify authz tests for peer OWNER (403), OWNER below (ok), ADMIN in own group (ok)

## 4. Authentication

- [x] 4.1 Login: parse with `credentialsSchema` first, use normalized username for limiter/lookup/audit, dummy bcrypt compare for unknown/inactive; verify tests "whitespace variant is still limited" and "unknown user performs a compare"
- [x] 4.2 Rate limiter counts in SQL (`count` by ip, `json_extract` by username) under the keyed lock; verify tests "sixth attempt blocked", "window expires", "parallel burst of 20 compares ≤ 5", "forged XFF ignored"
- [x] 4.3 `sessionVersion` in JWT at sign-in, compared in `revalidateSessionUser`, never taken from `update` trigger, missing value = mismatch; verify tests "reset ends sessions", "update cannot adopt new version"
- [x] 4.4 `changePassword` increments `sessionVersion`, is rate limited, and the action signs out to `/login?pesan=password-diubah` with an Indonesian banner on the login page; verify tests and manual check of the banner
- [x] 4.5 `lib/auth/require-session.ts`; replace every local `requireSession` in `app/**/actions.ts`; only `changePasswordAction`/`signOutAction` opt in; verify test "create-member action refused while mustChangePassword" and a test that greps every `"use server"` file for direct `auth()` use
- [x] 4.6 CSP adds `base-uri 'none'; object-src 'none'; form-action 'self'`; HSTS production-only; verify `curl -I` on dev (no HSTS) and on `pnpm start` (HSTS present), and a forms/login still submits

## 5. User management & authorization

- [x] 5.1 `lib/user/dto.ts#toUserDto`; `createUser`/`setUserActive` return DTOs; verify test that serializes every user action result and finds no key starting with `password`
- [x] 5.2 Root-OWNER invariant checked after write inside the transaction for setActive/updateRole/move (self-move included); verify tests "last root owner self-move rejected", "two owners: one may move", "concurrent mutual deactivation: exactly one succeeds"
- [x] 5.3 `resetUserPassword` increments `sessionVersion`; verify existing reset tests + session-ended test
- [x] 5.4 `scripts/reset-owner-password.ts` (+ `pnpm reset-owner-password <username> [--activate]`): temp password printed once, `mustChangePassword`, `sessionVersion++`, audit `actorId=null, meta.via="cli"`; verify test against test DB and non-zero exit for unknown username

## 6. Input validation

- [x] 6.1 Apply `dateSchema` to member, activity, occurrence, attendance schemas; add max lengths (activity name/location 200, notes 1000, override location 200 / notes 1000); verify schema tests for each oversize/invalid case
- [x] 6.2 Bound arrays (attendance entries ≤ 1000, weekdays ≤ 7, `parseGroupIds` ≤ 50); validate `activityId` in `updateActivityAction` with zod; verify tests "5000 entries rejected", "activityId 'abc' rejected"

## 7. Deployment files

- [x] 7.1 `deploy/nginx/ngaji.conf` (HTTP→HTTPS, `X-Forwarded-For $remote_addr`, `X-Real-IP`, `client_max_body_size 1m`); verify `nginx -t` in a container or on the VPS
- [x] 7.2 `deploy/systemd/ngaji.service` (`pnpm start -H 127.0.0.1 -p 3000`, hardening, `ReadWritePaths=/var/lib/ngaji /var/backups/ngaji`), `ngaji-backup.service`, `ngaji-backup.timer`; verify `systemd-analyze verify`
- [x] 7.3 `scripts/backup.sh` (`.backup` → integrity_check → gzip → age → rclone daily + monthly-if-missing → prune 30d/365d remote, keep 7 local → healthcheck ping, `set -euo pipefail` + `trap`); verify with `shellcheck` and a dry run against a local MinIO or a throwaway bucket
- [x] 7.4 `scripts/restore.sh <object|file> <identity>` (decrypt → integrity_check → stop → keep `.pre-restore-<ts>` → install 600 → start → curl `/login`; abort before touching prod on wrong key/corruption); verify with `shellcheck` and a restore of the 7.3 output onto a scratch DB path
- [x] 7.5 `deploy/env/backup.env.example` and `deploy/rclone.conf.example` (no secrets); verify `.gitignore` excludes real copies

## 8. Documentation

- [ ] 8.1 Rewrite DEPLOYMENT.md for IDCloudHost: VPS order (2 vCPU/2 GB/40 GB, Jakarta, Ubuntu 24.04), first-boot hardening (user, SSH keys, ufw, fail2ban, unattended-upgrades, swap, timezone), app install, Nginx/certbot, Object Storage bucket + key, `age` keygen on the owner's laptop, backup timer, healthchecks.io, restore runbook, quarterly drill log, upgrade procedure (backup + snapshot + audit gate), go-live checklist; verify by following it end-to-end on a fresh hourly VPS
- [ ] 8.2 Update DESIGN.md §3.4 (peer OWNER reset, CLI recovery), §4.1 (normalization, serialization, timing, sessionVersion, actions enforcement), §4.3 (CSP/HSTS, trusted IP), §4.4 (backup now specified), §8; update `openspec/config.yaml` context (Next 16, Prisma 7, SQLite) so it matches CLAUDE.md
- [ ] 8.3 `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint` (note pre-existing lint breakage if still present), `openspec validate security-hardening-and-deployment --strict` all pass

## 9. Go-live verification (on the VPS)

- [ ] 9.1 From outside: port 3000 refused, `http://` redirects, `curl -I https://…/login` shows CSP + HSTS, password SSH refused
- [ ] 9.2 Spoofed `X-Forwarded-For` login failure records the real IP in `/audit`
- [ ] 9.3 Trigger `systemctl start ngaji-backup`; object appears in `daily/` and `monthly/`, healthchecks.io shows success; break the endpoint once and confirm the failure alert arrives
- [ ] 9.4 Restore drill on a scratch VPS from the bucket with the offline key; record the date in DEPLOYMENT.md
