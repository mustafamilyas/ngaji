# Proposal

## Why

Today a member who moves to another leaf group is marked `PINDAH` and re-created as a new record (DESIGN.md §2 notes, §9.9). A member who leaves and later comes back has the same problem: setting them `AKTIF` again silently counts them as expected for the whole period they were away. Both split or distort one person's identity. Their member code and card (change `member-relations-and-codes`), relatives, tags and attendance history should follow them for life within the organization, and every group's past statistics must stay correct.

## What Changes

- **Membership history**: every member has dated group memberships (`from`–`to`), each a period of being `AKTIF` in one leaf group. Existing data is backfilled so that every statistic stays the same. "Expected" members (DESIGN.md §6), the attendance pages, attendance permission and participation use the member's membership **on the occurrence date**. The member page shows "Riwayat keanggotaan".
- **Direct move (push)**: ADMIN/OWNER (primary role) with the member in scope moves an `AKTIF` member to **any leaf group of the organization**, on a move date. Same record, same code, same relatives.
- **Pull request by member code**: ADMIN/OWNER enters a member code to request an active **or left** member from outside their scope into a leaf group in their scope. They see only name, current group and active/left status. Any ADMIN/OWNER with the member's current group in scope approves (a move, or a rejoin into the new group) or rejects. The requester can cancel. Requests expire after 14 days.
- **Leaving and rejoining**: "Nonaktifkan" (`KELUAR` / `MENINGGAL` + date) and "Aktifkan kembali" (+ date, into the last group; rejoining on the exit date undoes the exit). Only ADMIN/OWNER whose scope includes the member's group may do this. **The edit form no longer changes status** for any role.
- **Date guard** for move, exit and rejoin: ≤ today, after the current period starts, and after the latest recorded attendance where relevant.
- **Tags** not usable in the new group are detached in the same transaction (audited).
- **`PINDAH` is retired for new data**: a move is shown as history, not as a status. Existing `PINDAH` records stay readable and can be rejoined. Duplicates from the old approach are left as is.
- Creating or importing `KELUAR`/`MENINGGAL` (historical) members requires ADMIN/OWNER.
- Audit: `member.move`, `member.exit`, `member.rejoin`, `member_move_request.create/approve/reject/cancel`.
- Out of scope: re-parenting groups, moving or (de)activating login users, cross-organization moves, merging old duplicates, external notifications.

## Capabilities

### New Capabilities
- `member-group-history`: dated memberships, backfill, group-at-date semantics for expected/attendance/participation, history list.
- `member-move`: direct move, move date guard, tag cleanup, audit, dialog.
- `member-move-request`: pull by member code (active or left), preview, approval, rejection, cancellation, expiry, pages.
- `member-exit-rejoin`: leaving and rejoining, permissions, status removed from the edit form, status rules for create/import, `PINDAH` retirement.

### Modified Capabilities
- None among `openspec/specs/`. The member list and member views keep using the current group and status.

## Impact

- Depends on `member-relations-and-codes` (member code, normalization). Implement after it.
- Prisma: `MemberGroupMembership`, `MemberMoveRequest`; migration with SQL backfill.
- `lib/stats.ts` (`expected`, participation, activity stats), `lib/attendance/*`, `lib/authz.ts` (`member.move`, `member.exit`, `member.rejoin`, `member_move_request.*`), `lib/member/mutations.ts` + `lib/validation/member.ts` (status out of the edit form), `lib/member/import/*` (status rules), new `lib/member/membership.ts`, `lib/member/move-request.ts`.
- UI: member page actions (Pindahkan, Nonaktifkan, Aktifkan kembali), Riwayat keanggotaan, the edit form without status, `/dashboard/anggota/pindah`, the sidebar badge.
- DESIGN.md: §2 model + notes (PINDAH), §3.2 matrix, §4.5 audit, §5.6/§6 membership-at-date, §7 pages, §9.9, §10 row removed, new §15.
