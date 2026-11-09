# Design

## Context

- `Member.groupId` is the only notion of group. `expected()` in `lib/stats.ts` filters members by `group.path startsWith Y` plus `joinedAt`/status/`exitedAt`. Attendance permission (`lib/attendance/*`, DESIGN.md §3.3) resolves the member's leaf group from `Member.groupId`.
- No member can change group today: `updateMemberSchema` has no `groupId`.
- Scope invariant: anything out of scope gives 404. The pull lookup is a deliberate, narrow exception (exact code, ADMIN+, name and group only).
- Requires `member-relations-and-codes` (`Member.code`, `normalizeMemberCode`).

## Goals / Non-Goals

**Goals:**
- One person, one record, one code, for life within the organization.
- Every historical number stays the same after a move.
- No background jobs (expiry is derived).

**Non-Goals:**
- Re-parenting groups, moving login users, cross-organization moves, merging legacy duplicates, email or WhatsApp notifications.

## Decisions

### 1. `MemberGroupMembership` with `Member.groupId` kept as the current group
```prisma
model MemberGroupMembership {
  id        Int     @id @default(autoincrement())
  memberId  Int
  groupId   Int     // leaf group
  fromDate  String  // YYYY-MM-DD
  toDate    String? // inclusive; null = current
  @@index([memberId, fromDate])
  @@index([groupId, fromDate])
}
```
- A membership is a period of being **active** in a group, so moves, exits and rejoins are all expressed the same way: close the open period, maybe open another. `status`/`exitedAt` remain on `Member` as the current state (used by the member list, views and member statistics), and memberships are the source of truth for dates.
- `Member.groupId` stays, denormalized as "group of the open membership, or of the last one if the member has left". All current-state queries (member list, views, member statistics, scope checks for editing) remain unchanged and fast. Only date-dependent code switches to memberships.
- The invariants (no overlap; one open iff `AKTIF`; the open or last one equals `Member.groupId`) are kept by the only writers, `createMember`/import, `moveMember`, `exitMember` and `rejoinMember`, and checked in tests. SQLite can't express the constraints.
- *Alternative*: drop `Member.groupId` and always derive it. Rejected: it touches every query in the app for no behavior gain.
- *Alternative*: store a group snapshot on each `Attendance` row. Rejected: "expected" also needs members **without** attendance rows (absent), so history must live on the member.

### 2. Date-aware `expected()`
- `expected(occurrence D, group Y)` becomes: non-deleted members with a membership where `fromDate ≤ D ≤ coalesce(toDate, '9999-12-31')` and the membership's group path starts with Y's path. The old `joinedAt`/status/`exitedAt` test is replaced, not combined: the backfill (spec "Backfill") makes the two equivalent for existing data, and memberships additionally express gaps. String date comparison is valid (ISO).
- Participation (per member) iterates over the member's memberships: for each one, the occurrences of activities that apply to that membership's group within `[from, to]`, clipped by the existing `[max(dari, joinedAt), min(sampai, exitedAt ?? today)]`.
- Attendance permission: "member's leaf group" becomes "member's leaf group on the occurrence date". If none, reject.
- These functions are pure or near-pure and get tests first: one member, two memberships, an occurrence on each side, and an inherited activity spanning the move.

### 3. Move date guard
- `earliestMoveDate(member) = max(currentMembership.fromDate + 1, lastAttendanceEffectiveDate + 1)`. The last attendance is over all occurrences, using the effective date (`overrideDate ?? date`).
- `M ≤ today(org tz)`. The current membership ends on M − 1 and the new one opens on M. Equality with `fromDate` is impossible, so there are no zero-length memberships.
- Editing `joinedAt` updates the first membership's `fromDate`, and is rejected when the member has moved and the new date is ≥ the second membership's `fromDate`.

### 3a. Exit and rejoin
- `exitMember(tx, member, status, E)`: guard `E ≤ today`, `E > open.fromDate`, `E > lastAttendance`. Close the open membership at E − 1 and set `status` and `exitedAt`. Audit `member.exit`.
- `rejoinMember(tx, member, R, toGroup = member.groupId)`: guard `exitedAt ≤ R ≤ today` (legacy rows without `exitedAt`: R after the last membership's end). If `R == exitedAt`, `toGroup` is the last group and the last membership ended on `exitedAt − 1`, reopen it (`toDate = null`) so an exit by mistake leaves no trace in statistics. Otherwise open a new membership. Set `AKTIF`, clear `exitedAt`, clean up tags if the group changed. Audit `member.rejoin`.
- `updateMemberSchema` drops `status`/`exitedAt`. `createMemberSchema` keeps them, but the action rejects non-`AKTIF` for USER and `PINDAH` for everyone. Import does the same per row, as row errors.
- *Alternative*: keep status in the edit form and derive memberships from status changes. Rejected: an edit has no "effective date", so the history would be wrong whenever the form is saved late.

### 4. Move = one transaction
`moveMember(tx, member, toGroup, date, actor, requestId?)`:
1. Re-read the member and the open membership inside the transaction.
2. Re-check the guard.
3. Close and open memberships, and update `Member.groupId`.
4. Delete `MemberTag` rows whose tag owner is not an ancestor-or-self of the destination.
5. Write `audit member.move`.

Used by both direct moves and approvals.

### 5. `MemberMoveRequest`
```prisma
model MemberMoveRequest {
  id            Int       @id @default(autoincrement())
  memberId      Int
  toGroupId     Int
  moveDate      String
  note          String?
  status        String    // PENDING | APPROVED | REJECTED | CANCELLED
  requestedById Int
  decidedById   Int?
  decisionNote  String?
  decidedAt     DateTime?
  createdAt     DateTime  @default(now())
  @@index([memberId, status])
  @@index([status, createdAt])
}
```
- "Expired" is derived (`PENDING` and `createdAt < now − 14 days`) and never stored. That keeps the status free of time-dependent writes.
- "At most one pending" is checked in the transaction against unexpired `PENDING` rows.
- The approver's scope is checked against the member's **current** group at decision time, not at request time.
- Lookup is a server action that takes a code and returns `{ name, groupName } | notFound | inScope`. All failure cases share one response shape and message, so it is no oracle across organizations. Codes are 32⁶ per prefix and the lookup is ADMIN-only, so brute-force enumeration is not practical. There is no extra rate limit in this change.

### 6. Pages and badge
- `/dashboard/anggota/pindah` uses the list layout conventions (§7.1), with tabs via `?tab=masuk|terkirim`.
- The sidebar badge counts unexpired pending requests whose member's current group is in the user's scope. It is computed in the layout's existing per-request data load as one `count` query.

## Risks / Trade-offs

- [Every date-aware query now joins memberships, so it is slower] → Indexed on `(groupId, fromDate)` and `(memberId, fromDate)`. Data sizes are small (SQLite, thousands of members).
- [Old-group users still see a moved member's name in past attendance] → Name and status only, needed to keep their own records correct. This was accepted in the spec.
- [Admin moves a member out of their scope by mistake] → A confirmation step names the destination, the move is audited, and someone with scope over the destination can move them back.
- [Legacy PINDAH duplicates remain] → Accepted by the user. `PINDAH` stays readable (meaning "moved to another leaf group, old style") but is no longer selectable. New moves are history, not a status.
- [USERs lose the ability to mark members as left] → This is the user's decision. ADMIN/OWNER of the group or an ancestor does it, with an effective date.
- [Membership invariants enforced in code only] → A single writer function plus an invariant test helper used in the move, create and import tests.

## Migration Plan

1. The migration creates both tables and backfills memberships in SQL: an open row for `AKTIF` members, and for the others a row ending `date(exitedAt, '-1 day')` where `exitedAt > joinedAt`.
2. Deploy after `member-relations-and-codes` is live, because the pull lookup needs codes.
3. Sanity check: statistics for a sample group and range are identical before and after the deploy; every `AKTIF` member has exactly one open membership and no other member has one.
4. Rollback: the previous image ignores the new tables. Moves done in the meantime remain valid for it, because `Member.groupId` is always current.
