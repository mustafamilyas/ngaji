## 1. Scaffold

- [ ] 1.1 Create Next.js 15 (App Router, TS) project with pnpm; add Tailwind, shadcn/ui, ESLint, Vitest with one passing dummy test
- [ ] 1.2 Add Prisma 6 and `docker-compose.yml` for PostgreSQL 16; add `.env.example`, ensure `.env` is git-ignored
- [ ] 1.3 Base layout: mobile-first nav shell, Bahasa Indonesia labels, empty `/` page; verify `pnpm dev`, `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test` all pass

## 2. Schema, seed, foundations

- [ ] 2.1 Write `prisma/schema.prisma` exactly per DESIGN.md §2 (incl. `AuditLog`, `mustChangePassword`, `joinedAt`, `deletedAt` on Member, `overrideDate`/`overrideDurationMinutes`, `continuesFromId`, FK relations for `createdById`/`recordedById`) and run the initial migration
- [ ] 2.2 Implement `lib/dates.ts` (`today()` in Asia/Jakarta, `toDbDate`/`fromDbDate`, `addDays`, `sundayOf`, `weeksBetween`, `monthsBetween`, `daysBetween`) with tests that run under `TZ=UTC` and `TZ=America/New_York`
- [ ] 2.3 Implement `lib/constants.ts` (`AGE_BRACKETS`, `DEFAULT_STATS_RANGE_DAYS = 30`, `CONFLICT_HORIZON_DAYS = 90`, `PAGE_SIZE = 50`)
- [ ] 2.4 Implement `lib/db.ts` Prisma client with an extension injecting `deletedAt: null` into every Group/Member/Activity read; test that a soft-deleted row is not returned by `findMany` without a where clause
- [ ] 2.5 Write `prisma/seed.ts`: org, 4 levels, tree (1 pusat → 2 daerah → 2 desa each → 2 kelompok each) with paths, ~30 members, owner `admin/admin` (`mustChangePassword = true`), one daerah ADMIN, one kelompok USER; verify seed from empty DB

## 3. Pure activity and statistics logic (TDD, no UI)

- [ ] 3.1 `lib/validation/activity.ts` zod schema with refinements (midnight cap, ONCE/WEEKLY/MONTHLY rules, `endsOn ≥ startsOn`); tests for each rejection scenario in `activity-scheduling` spec
- [ ] 3.2 `lib/activity/expand.ts` `expandDates` — tests: ONCE in/out of range, DAILY interval 3, WEEKLY `[0,3]` interval 2 from a Wednesday (Sunday anchor), MONTHLY 31 skipping short months, `endsOn` bound, >366-day range throws
- [ ] 3.3 `lib/activity/occurrences.ts` `occurrencesFor(activity, from, to, rows)` — tests: union keeps rows with attendance after template edit, orphan without attendance ignored, `overrideDate` shifts `effectiveDate`, CANCELLED preserved, effective-date range filter
- [ ] 3.4 `lib/activity/conflicts.ts` — tests: touching windows no conflict, overlap across ancestor/descendant flagged, sibling branches never conflict, CANCELLED ignored
- [ ] 3.5 `lib/stats.ts` `expected(occurrence, members)` pure core — tests: `joinedAt > D` excluded, KELUAR with `exitedAt > D` included, KELUAR without `exitedAt` excluded, `deletedAt` excluded

## 4. Authentication

- [ ] 4.1 Auth.js v5 Credentials provider with bcrypt cost 12, `isActive` check, generic failure message; `lib/validation/auth.ts` (password ≥ 8)
- [ ] 4.2 `lib/audit.ts` `audit(tx, …)` helper with redaction of `passwordHash` / `password*`; log `auth.login`, `auth.login_failed` (with `meta.username`, `actorId` null for unknown user), `auth.logout`; redaction unit test
- [ ] 4.3 Login rate limit from `AuditLog` (≥5 per username or ≥20 per IP in 15 min); test sixth attempt blocked and window expiry
- [ ] 4.4 `jwt` callback re-reads `User` + `UserGroupRole` on every session read: terminate if inactive, refresh `role`/`groupId`/`groupPath`; integration tests for deactivate-mid-session and demote-mid-session
- [ ] 4.5 Session cookie flags (`httpOnly`, `sameSite=lax`, `secure` in prod, 7 days); `/login` page
- [ ] 4.6 `mustChangePassword` redirect in `middleware.ts`; `/akun/password` page + Server Action (current password required, audit `user.change_password`, clear flag)
- [ ] 4.7 Security headers in `next.config.ts` (HSTS, CSP with `default-src 'self'` and `frame-ancestors 'none'`, nosniff, Referrer-Policy); verify with `curl -I`

## 5. Authorization core

- [ ] 5.1 `lib/errors.ts` (`NotFoundError` → 404, `ForbiddenError` → 403, `ValidationError`) and a Server Action wrapper that maps them to generic user messages and logs stack traces server-side only
- [ ] 5.2 `lib/resolve.ts` — `resolveGroup/Member/Activity/Occurrence/User` returning entity + `group.path`, throwing `NotFoundError` for soft-deleted or out-of-scope
- [ ] 5.3 `lib/authz.ts` — `Action` union, `authorize(session, action, target)`, `visibleGroupsWhere(session)`, `canViewActivity`, `canEditActivity`, `canRecordAttendance`, self-protection and last-root-OWNER rules
- [ ] 5.4 Table-driven tests covering every row of the permission matrix × 3 roles, plus: root OWNER cannot edit kelompok activity; daerah ADMIN cannot record attendance for kelompok activity; kelompok USER can record for daerah activity; ADMIN cannot reset peer ADMIN / child-group USER / OWNER; OWNER can reset OWNER in scope; self-deactivate and last-root-OWNER rejected
- [ ] 5.5 Checkpoint A: all tests green, `tsc` clean, review with project owner before UI work

## 6. Groups

- [ ] 6.1 `lib/validation/group.ts`; Server Actions create (insert + path update in one transaction, depth = parent+1, unique live sibling name), rename, soft-delete (empty check); audit `group.*`
- [ ] 6.2 `/grup` tree page and `/grup/[id]` detail (children, members, activities, users, add sub-group button gated by `canEdit`)
- [ ] 6.3 `/pengaturan/jenjang` rename levels (OWNER depth 0 only); audit `level.rename`
- [ ] 6.4 Negative tests: create under out-of-scope parent → 404, USER create → 403, delete non-empty → validation error, non-root OWNER rename → 404

## 7. Members

- [ ] 7.1 `lib/validation/member.ts` (`exitedAt` required when status ≠ AKTIF, `joinedAt` default today); Server Actions create/update/soft-delete with leaf-group check; audit `member.*` with full snapshots
- [ ] 7.2 `/anggota` list: scope filter, name search, group/status filters, `?page=` pagination with `PAGE_SIZE`, total count
- [ ] 7.3 `/anggota/baru` and `/anggota/[id]` forms (react-hook-form + shared zod), detail with attendance-history placeholder, soft-delete action
- [ ] 7.4 Tests: non-leaf create rejected, out-of-scope update → 404, deleted member absent from list/search, pagination page 3 of 120

## 8. Activities

- [ ] 8.1 Server Actions `activity.create/update/delete` (owning-group-only), "end from date" (`endsOn = X−1` or soft-delete), conflict warning on save (90-day horizon); audit `activity.*`
- [ ] 8.2 `/kegiatan` range list (default this week) via `occurrencesFor` over `ancestors ∪ self ∪ descendants`, badges warisan / konflik / dipindah / batal, `canEdit`/`canRecord` flags
- [ ] 8.3 `/kegiatan/baru` and `/kegiatan/[id]` template form + occurrence list; edit controls only when `canEdit`; sibling-branch activity → 404
- [ ] 8.4 `occurrence.override` Server Action: cancel, change time/duration/location/notes, move once (`overrideDate`; reject if target already an occurrence; reject invalid rule date → 404); audit `occurrence.override`
- [ ] 8.5 `activity.split` Server Action (transaction: `endsOn = X−1`, clone with `continuesFromId`, re-parent rows `date ≥ X`; in-place edit when `X ≤ startsOn`); audit `activity.split` with `{fromActivityId, toActivityId, fromDate}`
- [ ] 8.6 Tests: inherited activity read-only for kelompok ADMIN, root OWNER edit → 403, move-once row shape and URL key, split re-parents occurrences and keeps attendance, override on invalid date → 404, conflicting save still succeeds with warning

## 9. Attendance

- [ ] 9.1 `attendance.save` Server Action: all six `canRecordAttendance` conditions, transactional upsert occurrence → upsert/delete rows → `audit('attendance.save')` with `set`/`removed`; whole save fails on any foreign `memberId`
- [ ] 9.2 `/kegiatan/[id]/[tanggal]?grup=Y` page: leaf selector for non-leaf users, expected members via `expected()`, one-tap HADIR/IZIN at 375 px, read-only when CANCELLED or future
- [ ] 9.3 Attendance history on `/anggota/[id]`
- [ ] 9.4 Tests: daerah ADMIN for kelompok activity → 403, kelompok USER for daerah activity OK, non-leaf `grup` rejected, future date rejected, invalid date → 404, foreign `memberId` rejects entire payload, uncheck deletes row, single audit entry per save

## 10. Statistics and dashboard

- [ ] 10.1 `lib/stats.ts` queries built on `expected()`: member stats (AKTIF, by sex/marital/work/age bracket/direct sub-group), activity stats per occurrence (hadir/izin/absent/expected/%), trend by date, breakdown by sub-group, participation per member with `[max(from, joinedAt), min(to, exitedAt ?? today)]`
- [ ] 10.2 `/statistik` with three tabs (Recharts), default range 30 days, sortable participation table
- [ ] 10.3 `/` dashboard: scope summary + next 7 days occurrences
- [ ] 10.4 Tests against seeded data: cancelled excluded, % ≤ 100 after a leaver, age-bracket boundary at 60, participation window bounds

## 11. Users

- [ ] 11.1 `lib/validation/user.ts`; Server Actions create (OWNER/ADMIN; OWNER role by OWNER only; server-generated password shown once, `mustChangePassword`), update role / move / set active (OWNER only + self-protection), reset password per policy; audit `user.*` without passwords
- [ ] 11.2 `/pengguna` page listing users in scope with controls gated per caller; temporary password displayed once
- [ ] 11.3 Tests: ADMIN reset peer ADMIN → 403, ADMIN reset child-group USER → 403, OWNER reset in child group OK, ADMIN create OWNER → 403, move to out-of-scope group → 404, last root OWNER deactivate rejected, password never in audit

## 12. Audit viewer and final checkpoint

- [ ] 12.1 `/audit` page (OWNER only, else 404): scope-filtered by `groupId`, newest first, filters for action/actor/date range, `PAGE_SIZE` pagination
- [ ] 12.2 Test: ADMIN → 404; entries from another daerah hidden; `after` snapshots never contain `passwordHash`
- [ ] 12.3 Checkpoint B: `pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm audit` green; end-to-end walkthrough at mobile width (login → change password → group → member → activity → attendance → statistics → audit); DESIGN.md and specs in sync
