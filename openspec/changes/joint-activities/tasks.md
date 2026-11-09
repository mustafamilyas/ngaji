# Tasks

## 1. Model and pure rules

- [ ] 1.1 Add `ActivityCoOwner` (design D1) + `CO_OWNER_STATUSES` in `lib/validation/enums.ts`; run `pnpm prisma migrate dev` and verify the migration applies on a fresh and a seeded DB
- [ ] 1.2 Write `eligibleCoOwner` (D7) test-first: self, ancestor, descendant, duplicate, sibling, cousin; verify `pnpm test lib/activity`
- [ ] 1.3 Write `ownersOn`, `currentOwners`, `ownerHistory` (D2) test-first: creator always, accepted within `[startsOn, endsOn]`, pending/declined/cancelled never; verify `pnpm test lib/activity`
- [ ] 1.4 Write `ownershipWindowViolation` (D8) test-first: later start past recorded date, end before recorded date, earlier start always allowed; verify `pnpm test lib/activity`

## 2. Authorization

- [ ] 2.1 Make `canViewActivity`, `canEditActivity`, `canRecordAttendance` owner-aware and add `canDeleteActivity`, `isJointAdmin` (D3), test-first with the spec's negative cases (joint owner USER, ancestor admin, removed joint owner, pending group, unrelated user); verify `pnpm test lib/authz`
- [ ] 2.2 Add actions `activity.invite`, `activity.respond`, `activity.manageCoOwners` to `authorize`; route `activity.delete` and deleting ends through `canDeleteActivity`; load joint owners in `resolveActivity` incl. invitation mode (D5); tests for 403 vs 404; verify `pnpm test lib/authz lib/resolve`
- [ ] 2.3 Make `canTagActivity` check every current owner group (D9); tests for joint owner tag, pending group rejected, unrelated branch rejected, other side not seeing the tag; verify `pnpm test lib/tag`

## 3. Mutations

- [ ] 3.1 Server actions invite (with start date) / change start date / cancel / accept / decline / remove with zod schemas in `lib/validation/activity.ts`, each in one transaction with its audit entry and the D8 guard where dates change; tests for every scenario under "Joint owner eligibility", "Membership is managed by the creator group", "Invited group accepts or declines", "Joint ownership dates never hide recorded attendance"; verify `pnpm test`
- [ ] 3.2 Template update, override, split, end by joint owner admins; delete and deleting ends creator-only; split keeps creator and copies joint owners; tests for "Editing rights of joint owners"; verify `pnpm test lib/activity app/dashboard/kegiatan`
- [ ] 3.3 Group-empty check counts pending/accepted joint ownership; test; verify `pnpm test lib/group`

## 4. Activity logic

- [ ] 4.1 §5.3 listing (owned, not inherited, for joint owner subtrees) and §5.4 conflicts use effective owners (D6); existing tests unchanged + new joint cases; verify `pnpm test lib/activity`
- [ ] 4.2 Attendance actions (`setMemberAttendance`, `saveAttendance`, check-in) and the attendance table population follow D3/D4; tests for joint admin both directions, joint owner USER rejected, date before start rejected, removed joint owner admin allowed up to end date and 404 after; verify `pnpm test`
- [ ] 4.3 `activityAttendanceSummary` and `activityStatistics` use owner populations per D4/D6; tests for "Attendance summaries by viewer"; verify `pnpm test lib/stats`

## 5. UI

- [ ] 5.1 Activity settings: "Pemilik bersama" section (list, status, start/end; creator admins: invite dialog with org-wide group picker marking ineligible groups and a start date defaulting to today, edit start date, cancel, remove from date in a danger zone); delete zone hidden for joint owners and the end form explains that ending on/before the start needs the creator group; component tests + `pnpm audit:viewport`
- [ ] 5.2 Invitation mode of the activity detail page and "Undangan kegiatan" list on `/dashboard` and `/dashboard/kegiatan` (paginated `EMBEDDED_PAGE_SIZE`) with accept/decline; page tests incl. attendance routes 404 and no tag picker while pending
- [ ] 5.3 *Gabungan* badge in list, calendar and print; header lists creator and joint owners; attendance table group filter covers owner leaves; out-of-scope member names rendered without links; tests + `pnpm audit:print` and `pnpm audit:viewport` clean

## 6. Docs and gate

- [ ] 6.1 Update DESIGN.md §2 (model), §3.2 (matrix rows), §3.3 (owner groups, editing split, joint admin exception), §4.5 (audit actions), §5.3–5.5, §6, §7, §13.3 (tagging joint activities); verify they match the spec
- [ ] 6.2 Seed: one joint activity between kelompok of different desa with attendance and tags on both sides; verify `pnpm prisma db seed` and `pnpm dev:scratch`
- [ ] 6.3 Run `pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm audit:viewport && pnpm audit:print` and confirm all pass
