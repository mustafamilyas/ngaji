# Proposal

## Why

A security review (2026-10-10) found that login brute-force protection can be bypassed entirely (whitespace in the username + spoofable `X-Forwarded-For`), Server Actions return `passwordHash` to the browser, sessions survive password changes, and the pinned Next.js version has known advisories. The app is about to go to production on IDCloudHost with member PII in a single SQLite file, and DESIGN.md §4.4 leaves backup/restore to a runbook that does not yet exist. Both must be fixed before go-live.

## What Changes

**Security fixes (code)**
- Rate limit counts failures by the *normalized* username (same trim as login) and by a client IP that cannot be forged behind the proxy; attempts for the same username/IP are serialized so parallel requests cannot all pass the check.
- Unknown/inactive usernames still run a bcrypt compare (no timing-based username discovery).
- A `sessionVersion` on `User` invalidates every existing session on own password change and on reset by someone else. **BREAKING (UX)**: after changing their password the user logs in again.
- `mustChangePassword` is enforced inside every Server Action, not only by the path-based proxy redirect.
- Server Actions return explicit DTOs; no `User` row (or any `passwordHash`) is ever sent to the client.
- Reset password: an OWNER may reset another OWNER only in a group *strictly below* their own (no peer reset). Lost root-OWNER access is recovered through a server-side CLI, audited.
- The last active root OWNER can no longer be lost via self-move or concurrent deactivate/demote (checked inside the write transaction).
- Input bounds: real calendar dates only, max lengths on free text, bounded arrays, validated `activityId` in `updateActivityAction`.
- CSP adds `base-uri 'none'`, `object-src 'none'`, `form-action 'self'`; HSTS only in production.
- Upgrade `next` to ≥ 16.3.8; move `shadcn` to devDependencies; `pnpm audit --prod` has to pass at high/critical.

**Deployment & operations (IDCloudHost)**
- Reference setup: IDCloudHost Cloud VPS (Jakarta, Ubuntu 24.04 LTS), Nginx + Let's Encrypt, app bound to `127.0.0.1`, systemd, firewall, SSH key-only.
- Versioned deploy files in `deploy/` (Nginx site, systemd units/timers) and scripts in `scripts/` (backup, restore, owner recovery).
- Daily online-consistent SQLite backup → integrity check → `age` encryption (private key kept off the server) → upload to IDCloudHost Object Storage (S3-compatible). Retention: daily 30 days, monthly 12 months; 7 local copies for fast restore. A failure alert is sent if a backup fails.
- Restore runbook + quarterly restore drill; manual VPS snapshot before every upgrade.
- DEPLOYMENT.md is rewritten around this setup; DESIGN.md §4 and §8 are updated.

## Capabilities

### New Capabilities
- `deployment-operations`: production hosting baseline, trusted client IP, encrypted offsite backup with retention, restore and drills, dependency hygiene.
- `input-validation`: server-side bounds on dates, text lengths and collection sizes for every Server Action input.

### Modified Capabilities
- `authentication`: rate-limit normalization/serialization, constant-time-ish unknown-user path, session invalidation on password change/reset, forced password change enforced in actions, CSP/HSTS details.
- `user-management`: OWNER-to-OWNER reset only strictly below; credential-free responses; emergency owner recovery CLI.
- `authorization`: last-root-OWNER protection extended to moves and made race-safe.

## Impact

- **Code**: `auth.ts`, `proxy.ts`, `next.config.ts`, `lib/auth/*`, `lib/http.ts`, `lib/authz.ts`, `lib/user/mutations.ts`, every `app/**/actions.ts` (shared `requireSession`), `lib/validation/*`.
- **Schema**: one migration adds `User.sessionVersion Int @default(0)`.
- **Dependencies**: `next` bump; `shadcn` → devDependencies. Server tools: `sqlite3`, `age`, `rclone`.
- **Ops**: new `deploy/` and `scripts/` directories; DEPLOYMENT.md replaced; one Object Storage bucket + access key; one `age` keypair whose private key is held offline by the project owner.
- **Out of scope** (follow-ups): audit-log PII retention/erasure, a restricted kiosk mode for the check-in page, peer OWNER deactivate/demote rules.
