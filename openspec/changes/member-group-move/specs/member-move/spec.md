# Spec Delta

## Purpose

Lets an admin move a member to another group in place, keeping the same record, member code, relatives and history, with safe rules for the move date and for tags.

## ADDED Requirements

### Requirement: Who may move
A user SHALL be able to move a member directly only if their primary role is ADMIN or OWNER, the member is non-deleted, `AKTIF` and in the user's scope, and the destination is a non-deleted leaf group of the same organization other than the member's current group. The destination MAY be outside the user's scope. All ids SHALL be resolved on the server.

#### Scenario: Desa admin moves within the desa
- **WHEN** an ADMIN of desa D moves a member of kelompok K1 to kelompok K2 (both under D)
- **THEN** the member's current group becomes K2

#### Scenario: Move out of the admin's scope
- **WHEN** an ADMIN of kelompok K1 moves a member of K1 to kelompok K9 of another desa
- **THEN** the move succeeds, and afterwards the member is no longer visible to that admin (404 on the member page)

#### Scenario: USER cannot move
- **WHEN** a USER of desa D tries to move a member of K1
- **THEN** the request is rejected with 403 and nothing changes

#### Scenario: Extra role does not grant move
- **WHEN** a USER holds an extra ADMIN role (DESIGN.md §3.2a) and tries to move a member
- **THEN** the request is rejected with 403

#### Scenario: Member out of scope
- **WHEN** an ADMIN submits the id of a member outside their scope or in another organization
- **THEN** the response is 404

#### Scenario: Destination not a leaf or in another organization
- **WHEN** the destination is a non-leaf group, a deleted group, or a group of another organization
- **THEN** the request is rejected and nothing changes (404 for another organization)

#### Scenario: Member not active
- **WHEN** the member's status is `KELUAR`
- **THEN** the move is rejected with "Hanya anggota aktif yang dapat dipindahkan" (rejoin first, or use a pull request)

### Requirement: Move date
A move SHALL take effect on a move date M, defaulting to today in the organization's time zone. M SHALL be ≤ today, after the start of the member's current membership, and after the effective date of the member's latest attendance record. Otherwise the move SHALL be rejected with a message naming the earliest allowed date. The current membership SHALL end on M − 1 and a new membership in the destination SHALL start on M.

#### Scenario: Backdated move
- **WHEN** today is 2026-03-10, the member's latest attendance is 2026-02-28 and M is 2026-03-01
- **THEN** the K1 membership ends 2026-02-28 and the K2 membership starts 2026-03-01

#### Scenario: Before latest attendance
- **WHEN** the member's latest attendance is 2026-03-05 and M is 2026-03-01
- **THEN** the move is rejected with "Tanggal pindah paling awal 2026-03-06"

#### Scenario: Future date
- **WHEN** M is tomorrow
- **THEN** the move is rejected

### Requirement: What moves with the member
A move SHALL keep the member's record, member code, `joinedAt`, status, relationships, survey responses and attendance unchanged. Tags whose owner group is not the destination or one of its ancestors SHALL be detached in the same transaction. All other tags SHALL stay.

#### Scenario: Code unchanged
- **WHEN** member `ANR-7K3MQ9` moves from K1 to K2
- **THEN** the member's code is still `ANR-7K3MQ9`

#### Scenario: Branch tag removed
- **WHEN** the member has K1's tag `binaan` and desa D's tag `fokus` (D an ancestor of both K1 and K2)
- **THEN** after moving to K2, `binaan` is detached and `fokus` stays

### Requirement: Move audit
A move SHALL write one `member.move` audit entry in the same transaction, with `meta: { fromGroupId, toGroupId, moveDate, removedTagIds, requestId? }` and `groupId` set to the source group. Detaching tags as part of a move SHALL NOT write separate `member.untag` entries. A rejected move SHALL write nothing.

#### Scenario: Audited move
- **WHEN** a move succeeds and removes one tag
- **THEN** exactly one `member.move` entry lists the source, destination, date and removed tag id

### Requirement: Move dialog
The member page SHALL show "Pindahkan" to users allowed to move that member. The dialog SHALL offer a destination picker over the organization's leaf groups (group names and their ancestor path only, no member data), a move date, and a summary of tags that will be removed. The dialog SHALL be usable at mobile width.

#### Scenario: Button hidden for USER
- **WHEN** a USER opens a member page
- **THEN** no "Pindahkan" action is shown

#### Scenario: Tag summary
- **WHEN** the admin picks a destination where `binaan` is not usable
- **THEN** the dialog warns "Tag berikut akan dilepas: binaan" before confirming
