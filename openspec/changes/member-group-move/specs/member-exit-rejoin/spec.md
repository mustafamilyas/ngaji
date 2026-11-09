# Spec Delta

## Purpose

Lets admins record that a member left the organization and later rejoined, on the same record with the same code, so that statistics exclude the period in between.

## ADDED Requirements

### Requirement: Who may change membership status
Marking a member as left ("Nonaktifkan") and rejoining them ("Aktifkan kembali") SHALL be allowed only to users whose primary role is ADMIN or OWNER and whose scope includes the member's current group (the user's own group or an ancestor). The member edit form SHALL NOT change `status` or `exitedAt` for any role. A status or exit date sent in an edit request SHALL be ignored.

#### Scenario: Kelompok admin deactivates
- **WHEN** an ADMIN of kelompok K marks a member of K as left
- **THEN** the member's status changes and the change is audited

#### Scenario: Desa admin above
- **WHEN** an ADMIN of desa D (ancestor of K) rejoins a left member of K
- **THEN** the member becomes `AKTIF`

#### Scenario: USER cannot deactivate
- **WHEN** a USER of K tries to mark a member of K as left
- **THEN** the request is rejected with 403 and nothing changes

#### Scenario: Admin of another branch
- **WHEN** an ADMIN of sibling kelompok K2 tries to deactivate or rejoin a member of K
- **THEN** the response is 404

#### Scenario: Status in edit request ignored
- **WHEN** a USER submits the edit form with `status = KELUAR`
- **THEN** the other fields are saved and the status is unchanged

#### Scenario: Extra role does not grant it
- **WHEN** a USER holding an extra ADMIN role (DESIGN.md §3.2a) tries to deactivate a member
- **THEN** the request is rejected with 403

### Requirement: Leaving
An `AKTIF` member SHALL be marked as left with a status `KELUAR` or `MENINGGAL` and an exit date E. E SHALL be ≤ today (organization time zone), after the start of the open membership, and after the effective date of the member's latest attendance record. The open membership SHALL end on E − 1, `status` and `exitedAt = E` SHALL be set, and one `member.exit` audit entry SHALL be written in the same transaction. Tags and relationships SHALL be kept.

#### Scenario: Leave
- **WHEN** an admin marks a member as `KELUAR` on 2026-04-01
- **THEN** the open membership ends 2026-03-31, status is `KELUAR`, `exitedAt` is 2026-04-01, and the member is not expected from 2026-04-01

#### Scenario: Before latest attendance
- **WHEN** the member has attendance on 2026-04-05 and E is 2026-04-01
- **THEN** the request is rejected with "Tanggal keluar paling awal 2026-04-06"

#### Scenario: Already left
- **WHEN** an admin marks a `KELUAR` member as left
- **THEN** the request is rejected

### Requirement: Rejoining
A member with status `KELUAR` or `MENINGGAL` (correcting a mistake) SHALL be rejoined with a rejoin date R, where R ≥ the exit date and R ≤ today. A new open membership in the member's last group SHALL start on R, except when R equals the exit date and the last membership ended on E − 1. In that case the last membership SHALL be reopened, which undoes the exit with no gap. `status` SHALL become `AKTIF`, `exitedAt` SHALL be cleared, and one `member.rejoin` audit entry SHALL be written. The member's code, `joinedAt`, tags and relationships SHALL be unchanged. (The last group cannot be deleted, because a group with non-deleted members is not empty.) To rejoin into another group, a pull request by code (`member-move-request`) SHALL be used. Legacy `PINDAH` members SHALL be rejoinable the same way.

#### Scenario: Rejoin after a gap
- **WHEN** a member left on 2026-04-01 and is rejoined on 2026-06-01
- **THEN** a new membership in the same group starts 2026-06-01 and the member keeps their code

#### Scenario: Undo an exit
- **WHEN** a member was marked `KELUAR` on 2026-04-01 by mistake and is rejoined with R = 2026-04-01
- **THEN** the previous membership is reopened and statistics are as if the member never left

#### Scenario: Rejoin date before exit
- **WHEN** R is earlier than the exit date
- **THEN** the request is rejected

### Requirement: Creating and importing with a status
New members SHALL NOT be given the status `PINDAH`. Creating or importing a member with status `KELUAR` or `MENINGGAL` (historical records) SHALL require ADMIN or OWNER as primary role and an exit date after `joinedAt`. Such a member SHALL get one closed membership from `joinedAt` to the exit date − 1. A USER creating or importing SHALL only create `AKTIF` members, and an import with non-`AKTIF` rows by a USER SHALL report those rows as errors.

#### Scenario: USER import with KELUAR row
- **WHEN** a USER imports a CSV containing a `KELUAR` row
- **THEN** that row is reported as an error and is not imported

#### Scenario: PINDAH rejected
- **WHEN** any user creates or imports a member with status `PINDAH`
- **THEN** it is rejected with "Status PINDAH tidak lagi dipakai; gunakan Pindahkan"

#### Scenario: Admin imports a historical member
- **WHEN** an ADMIN imports a `KELUAR` member who joined 2020-01-01 and left 2024-06-01
- **THEN** the member has one membership from 2020-01-01 to 2024-05-31 and no open membership

### Requirement: Member page actions
The member page SHALL show "Nonaktifkan" (for `AKTIF` members) or "Aktifkan kembali" (for left members) to users allowed to use them. Each SHALL open a dialog with the status choice (leaving only), a date defaulting to today, and the earliest allowed date shown. The dialogs SHALL be usable at mobile width. `PINDAH` SHALL remain readable on existing records but SHALL NOT be offered anywhere.

#### Scenario: Hidden for USER
- **WHEN** a USER opens a member page
- **THEN** neither action is shown, and the edit form has no status field
