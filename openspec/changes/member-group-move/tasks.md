# Tasks

Prerequisite: `member-relations-and-codes` implemented (member code and `normalizeMemberCode`).

## 1. Schema & migration

- [ ] 1.1 Add `MemberGroupMembership` and `MemberMoveRequest` (design §1, §5) with a SQL backfill (open row for AKTIF, closed row ending exitedAt − 1 for others); `pnpm prisma migrate dev` on a seeded DB leaves exactly one open membership per AKTIF member and none for others
- [ ] 1.2 Add `MOVE_REQUEST_EXPIRY_DAYS = 14`, `MOVE_REQUEST_NOTE_MAX = 200` to `lib/constants.ts` and `MOVE_REQUEST_STATUSES` to `lib/validation/enums.ts`; `pnpm tsc --noEmit` passes

## 2. Pure logic (tests first)

- [ ] 2.1 `membershipOn(memberships, date)` and `earliestMoveDate(...)` in `lib/member/move.ts` with tests (boundaries, open membership, latest attendance)
- [ ] 2.2 Date-aware `expected()` in `lib/stats.ts` with tests: old group before the move, new group after, inherited activity spanning the move, no double counting
- [ ] 2.3 Exit/rejoin guards (`earliestExitDate`, rejoin bounds, reopen-on-undo rule) with tests
- [ ] 2.4 `isRequestExpired(request, now)` with tests at 14 days ± 1 minute

## 3. History everywhere

- [ ] 3.1 `createMember` and CSV import create the first membership in the same transaction; `joinedAt` edits sync the first membership and are rejected after a move; tests plus an invariant helper in `lib/test`
- [ ] 3.2 Attendance permission and the attendance table use the group on the occurrence date (`lib/attendance/*`); tests for recording before and after a move, from both groups
- [ ] 3.3 Activity statistics and member participation use memberships; `lib/stats.queries.test.ts` asserts identical numbers for a never-moved dataset and correct splits for a moved member
- [ ] 3.4 Moved-out members appear in old-group attendance tables and per-occurrence stats by name and status only; the payload test asserts no link id, phone or address

## 4. Direct move

- [ ] 4.1 `member.move` in `lib/authz.ts` (primary ADMIN/OWNER, member in scope; destination any leaf in the org) with denied-case tests (USER, extra role, out-of-scope member, other-org destination, non-leaf)
- [ ] 4.2 `moveMember` transaction (design §4): guard, memberships, `Member.groupId`, tag cleanup, `member.move` audit; tests for backdating, guard failure, code unchanged, tag removal
- [ ] 4.3 "Pindahkan" dialog on the member page (org leaf-group picker, date, tag-removal warning, confirmation) with DOM tests; hidden for USER

## 4a. Leaving and rejoining

- [ ] 4a.1 `member.exit` / `member.rejoin` in `lib/authz.ts` (primary ADMIN/OWNER, member's group in scope) with denied-case tests (USER, extra role, sibling branch)
- [ ] 4a.2 `exitMember` / `rejoinMember` transactions (design §3a) with audit; tests for gap statistics, undo on exit date, guard failures, legacy PINDAH rejoin
- [ ] 4a.3 Remove `status`/`exitedAt` from the edit schema and form; create and import reject non-AKTIF for USER and PINDAH for all; tests for the ignored status field and the import row errors
- [ ] 4a.4 "Nonaktifkan" / "Aktifkan kembali" dialogs and the "Riwayat keanggotaan" list on the member page, with DOM tests; hidden for USER

## 5. Pull requests

- [ ] 5.1 `lookupMemberByCode` server action (design §5): ADMIN+ only, active or left members, identical response for unknown, other-org, deleted or MENINGGAL; in-scope message; tests including the cross-org isolation case
- [ ] 5.2 Create, approve, reject and cancel actions with audit, single-pending rule, expiry, approver scope checked on the current group, guard re-checked on approval, approval of a left member = rejoin into the destination; tests for every scenario in the `member-move-request` spec
- [ ] 5.3 `/dashboard/anggota/pindah` (Masuk / Terkirim tabs, "Minta pindah dengan kode" form using `useKeepValues`) and the sidebar badge; page tests for scoping and 404 for USER

## 6. Seed, audit, docs

- [ ] 6.1 Seed: one moved member with attendance on both sides, one member who left and rejoined, one pending request; `pnpm prisma db seed` succeeds
- [ ] 6.2 `pnpm audit:viewport` covers the move/exit/rejoin dialogs, the history list and `/dashboard/anggota/pindah`; exit 0
- [ ] 6.3 DESIGN.md: §2 model + PINDAH note (retired for new data), §3.2 matrix, §4.5 audit, §5.6 and §6 group-at-date, §7 pages, §9.9, §10 row removed, new §15 Pindah, keluar & bergabung kembali; DEPLOYMENT/release note sanity check (stats unchanged, one open membership each)
- [ ] 6.4 `pnpm lint && pnpm tsc --noEmit && pnpm test` pass; manual check on `pnpm dev:scratch`: push a move across desa, pull by code with approval from the source kelompok, verify both groups' statistics
