## Why

The organization currently tracks members and recurring activities across four hierarchy levels (pusat → daerah → desa → kelompok) by hand, with no reliable attendance history and no controlled access to sensitive member data (PII). A single internal web app with scoped access, an append-only audit trail and lazy occurrence tracking replaces that, and the design has been agreed in `DESIGN.md` — this change turns it into verifiable specs and an implementation plan.

## What Changes

- New Next.js 15 + Prisma + SQLite application, single organization per deployment.
- Fixed, renameable group levels; groups form a tree with a materialized path (`"1/5/12/"`) used for scope filtering.
- Members live only in leaf groups; leaving is a status change; deletion is soft everywhere (no hard delete for any domain entity).
- Username/password auth (Auth.js v5 Credentials) with per-request revalidation of `isActive` and `role`, login rate limiting, forced password change after seed/reset, security headers.
- Role-based, scope-bound authorization (`OWNER`/`ADMIN`/`USER`) enforced by a single `authorize()` helper; every client-supplied ID is resolved and checked server-side; out-of-scope entities answer 404.
- Recurring activity templates owned by a group and inherited by all descendants; occurrences expanded by a pure function and materialized lazily; per-occurrence overrides (cancel, time/location, move once) and "move this and following" via a transactional split.
- Attendance (`HADIR`/`IZIN`, absence = no row) recorded for leaf groups on valid past/today occurrences by users at or below the activity's group.
- Statistics (members, activities, participation) using an `expected()` function that respects `joinedAt`/`exitedAt`.
- User management with a strict reset-password policy (OWNER: anyone in scope; ADMIN: only `USER` in the same group).
- Append-only `AuditLog` written in the same transaction as every mutation; OWNER-only viewer.

## Capabilities

### New Capabilities
- `group-hierarchy`: levels, group tree, materialized path, scope, soft delete, level rename.
- `authentication`: login, session claims and per-request revalidation, rate limiting, own-password change, forced password change, transport/header hardening.
- `authorization`: scope definition, permission matrix, `authorize()` contract, 404-for-out-of-scope.
- `member-management`: member CRUD in leaf groups, status/exit, soft delete, search/filter/pagination.
- `activity-scheduling`: activity templates, recurrence expansion, occurrence merging, conflict detection, inheritance visibility/edit rules, overrides, move-once, split, end.
- `attendance`: attendance recording rules and bulk save.
- `statistics`: expected-member function, member/activity/participation statistics, dashboard.
- `user-management`: create users, change role, move, activate/deactivate, reset password.
- `audit-log`: what is logged, redaction, transactional guarantee, viewer.

### Modified Capabilities
<!-- none — greenfield -->

## Impact

- Greenfield repo: everything under `app/`, `lib/`, `prisma/`, `tests/` is new.
- External dependencies: Next.js 15, Prisma 6, SQLite (file-based, no separate DB server), Auth.js v5, bcrypt, zod, react-hook-form, shadcn/ui, Recharts, Vitest.
- `DESIGN.md` remains the source of truth for schema and rules; `CLAUDE.md` lists the invariants agents must keep. This change's specs are derived from those documents and must be kept in sync with them.
- Security posture: member PII is stored; audit log stores before/after snapshots of PII and is restricted to OWNER within scope.
