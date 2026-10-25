# Release vX.Y.Z — <short title>

Copy this file to `docs/releases/YYYY-MM-DD-vX.Y.Z.md` (date = planned deploy day) and fill it in **before** deploying. Delete this paragraph and every hint line (`_..._`) in the copy. Procedure details live in [DEPLOYMENT.md](../../DEPLOYMENT.md); this document records what is specific to *this* release and what was checked.

| | |
|---|---|
| Version | vX.Y.Z |
| Date | YYYY-MM-DD |
| Commit | `<full sha>` (tag `vX.Y.Z`) |
| Previous release | `<link to previous release doc, or "none (first release)">` |
| Environment | `https://<domain>` |
| Deployed by | |
| Status | Draft / Deployed / Rolled back |

## 1. Summary

_2–5 lines: what changes for users, in plain words. Link OpenSpec change(s) if any._

## 2. Changes

_Group as Added / Changed / Fixed / Removed. One line each._

## 3. Risk and impact

- **Migrations:** _none, or list `prisma/migrations/<name>` with what it does and whether it is reversible._
- **Config / env changes:** _new or changed variables in `/opt/ngaji/.env`, Nginx, systemd. "None" if none._
- **Data impact:** _backfills, destructive changes, expected downtime._
- **Sessions:** _do users have to log in again?_
- **Dependency audit exceptions:** _new rows added to DEPLOYMENT.md §5, or "none"._

## 4. Pre-deploy checklist

- [ ] On the release commit: `pnpm lint && pnpm tsc --noEmit && pnpm test` pass
- [ ] `pnpm build` succeeds locally
- [ ] `pnpm audit:viewport` exits 0 (only if UI changed)
- [ ] `pnpm audit --prod` clean or exceptions recorded (DEPLOYMENT.md §5)
- [ ] DESIGN.md and OpenSpec specs updated if a design decision changed
- [ ] Fresh backup ran and succeeded: `sudo systemctl start ngaji-backup.service`
- [ ] VPS snapshot taken in the IDCloudHost console (name: `pre-vX.Y.Z`)
- [ ] Commit tagged: `git tag vX.Y.Z && git push origin vX.Y.Z`

## 5. Deploy steps

Standard upgrade (DEPLOYMENT.md §9):

```bash
cd /opt/ngaji
sudo -u ngaji git fetch --tags && sudo -u ngaji git checkout vX.Y.Z
sudo -u ngaji pnpm install --frozen-lockfile
sudo -u ngaji pnpm prisma generate
sudo -u ngaji pnpm prisma migrate deploy
sudo -u ngaji pnpm build
sudo systemctl restart ngaji
```

_Extra steps specific to this release (new env var, one-off script, ...) go here, in order. "None" if none._

## 6. Sanity checks (after deploy)

Run these on the live URL. Tick each box and note anything odd. The **Core** block is the same for every release; add release-specific checks in **This release**.

### Core

- [ ] `systemctl status ngaji` is active; `journalctl -u ngaji -n 50` shows no errors and no PII
- [ ] `curl -I http://<domain>/login` → 301 to https
- [ ] `curl -I https://<domain>/login` → 200 with `Content-Security-Policy` and `Strict-Transport-Security`
- [ ] Port 3000 refused from outside: `curl -m 5 http://<server-ip>:3000` fails
- [ ] Log in as OWNER; dashboard loads
- [ ] Wrong password is rejected with a generic message; logout works
- [ ] Member list loads and respects scope (an admin of a sub-group sees only their subtree)
- [ ] Create a member, edit it, and confirm both show in the audit log
- [ ] Attendance page works on a phone: mark one member HADIR, reload, state persists
- [ ] Statistik page renders charts for the default range
- [ ] A second organization's entity opened by URL returns 404 (isolation)
- [ ] Next backup after deploy succeeded (healthchecks.io green) — check the following morning

### This release

- [ ] _Check specific to the changes above_

## 7. Rollback

1. App-only problem, no migration applied: `git checkout <previous tag>`, rebuild, `systemctl restart ngaji`.
2. Migration applied or data damaged: restore the `pre-vX.Y.Z` VPS snapshot, or run `scripts/restore.sh` with the pre-upgrade backup (DEPLOYMENT.md §8) and redeploy the previous tag.
3. Record what happened in section 8 and set Status to `Rolled back`.

## 8. Outcome

_Fill in after deploy._

- Deployed at: _time (Asia/Jakarta)_
- Downtime: _none / N minutes_
- Issues found: _none / list_
- Follow-ups: _none / list_
