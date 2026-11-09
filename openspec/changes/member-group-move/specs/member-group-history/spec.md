# Spec Delta

## Purpose

Records which group a member belonged to, and when they were an active member, on each date, so that statistics, attendance and participation stay correct after a member moves, leaves or rejoins.

## ADDED Requirements

### Requirement: Dated memberships
Every non-deleted member SHALL have zero or more group memberships. Each membership SHALL have a leaf group, a `from` date and an optional `to` date (inclusive). A membership is a period during which the member was `AKTIF` in that group. Memberships of one member SHALL NOT overlap. An `AKTIF` member SHALL have exactly one open membership (`to` empty), and its group SHALL equal the member's current group. A member who has left (`KELUAR`, `MENINGGAL`, or legacy `PINDAH`) SHALL have no open membership, and their current group SHALL be the group of their last membership. Creating an `AKTIF` member (form or import) SHALL create its first membership from `joinedAt` in the same transaction.

#### Scenario: New member
- **WHEN** a member is created in kelompok K with `joinedAt` 2026-01-05
- **THEN** the member has one open membership in K from 2026-01-05

#### Scenario: Join date edited
- **WHEN** a never-moved, never-exited member's `joinedAt` is edited to 2025-12-01
- **THEN** the first membership's `from` becomes 2025-12-01

#### Scenario: Join date after the first period ends rejected
- **WHEN** a member whose first membership ends 2026-02-28 has `joinedAt` edited to 2026-03-10
- **THEN** the edit is rejected with a validation error

### Requirement: Backfill
The migration SHALL create memberships for every existing member, including soft-deleted ones, in their current group: an open membership from `joinedAt` for `AKTIF` members, and a closed membership from `joinedAt` to `exitedAt − 1` for others (none if `exitedAt ≤ joinedAt`). For every member and date, the backfilled data SHALL give the same "expected" result as the current rule (`joinedAt ≤ D` and (`AKTIF` or `exitedAt > D`)).

#### Scenario: Existing active and exited members
- **WHEN** the migration runs on a database with 280 active and 20 exited members
- **THEN** the active members each have one open membership, the exited members each have one closed membership ending the day before their exit date, and all statistics are unchanged

### Requirement: Group on the occurrence date
Wherever the app decides whether a member belongs to an occurrence (DESIGN.md §6 "expected", the attendance table, the attendance permission of §3.3, activity statistics and member participation), it SHALL use the member's membership on the occurrence's effective date D, i.e. the one with `from ≤ D` and (`to` empty or `to ≥ D`). A member with no membership on D (before joining, after leaving, or in a gap between leaving and rejoining) SHALL NOT be expected. The member SHALL also not be soft-deleted.

#### Scenario: Old group keeps its history
- **WHEN** a member of K1 moves to K2 on 2026-03-01 and a K1 activity occurred on 2026-02-20
- **THEN** the member is expected (and their attendance counted) for K1 on 2026-02-20, and not for K2

#### Scenario: New group from the move date
- **WHEN** the same member and a K2 activity on 2026-03-08
- **THEN** the member is expected for K2 on 2026-03-08, and not for K1

#### Scenario: Inherited activity across the move
- **WHEN** a desa activity covers both K1 and K2
- **THEN** each date counts the member once, under the group they belonged to on that date

#### Scenario: Gap between leaving and rejoining
- **WHEN** a member left on 2026-04-01 and rejoined on 2026-06-01
- **THEN** the member is not expected for any occurrence from 2026-04-01 through 2026-05-31, and is expected again from 2026-06-01

#### Scenario: Attendance in the old group after moving
- **WHEN** a K1 user records attendance for the moved member on a K1 occurrence dated after the move
- **THEN** the request is rejected because the member is not expected there

### Requirement: Moved-out members in history views
When a member's group on date D is in the viewer's scope but the member's current group is not, the attendance table and per-occurrence statistics for D SHALL show the member's name and recorded status only, without a link to the member page and without other member fields. Attendance for such a member MAY still be recorded or changed for dates before the move, under the usual rules.

#### Scenario: Past attendance table
- **WHEN** a USER of K1 opens a K1 occurrence from before the member moved to K2
- **THEN** the member is listed by name with their status, without a link, and the phone and address are not in the response

#### Scenario: Correcting past attendance
- **WHEN** a USER of K1 marks the moved member HADIR on a K1 occurrence dated before the move
- **THEN** the attendance is saved and audited

### Requirement: History on the member page
The member detail page SHALL show a "Riwayat keanggotaan" list with each membership, newest first: group, from and to dates, and how it ended ("Pindah ke K2", "Keluar", "Meninggal", or current). Group names outside the viewer's scope SHALL be shown as names only.

#### Scenario: Moved and rejoined member
- **WHEN** a member joined K1, moved to K2, left, and rejoined in K2
- **THEN** the list shows the K2 period (current), the K2 period ending "Keluar", and the K1 period ending "Pindah ke K2"
