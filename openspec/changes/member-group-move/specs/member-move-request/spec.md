# Spec Delta

## Purpose

Lets an admin pull a member from another branch into their own group using the member's code, with approval from an admin who has that member in scope, without exposing member data before approval.

## ADDED Requirements

### Requirement: Looking up a member by code
A user whose primary role is ADMIN or OWNER SHALL be able to look up a member by full member code (normalized as in `member-code`) in their own organization. The lookup SHALL return only the member's name and current group name, plus whether they are active or have left, and only when the member is non-deleted, has status `AKTIF`, `KELUAR` or legacy `PINDAH`, and is **outside** the user's scope. A member in scope SHALL return "Anggota ini sudah dalam cakupan Anda, gunakan Pindahkan atau Aktifkan kembali". Any other case (unknown code, another organization, deleted, `MENINGGAL`) SHALL return the same generic "Kode tidak ditemukan".

#### Scenario: Preview
- **WHEN** an ADMIN of kelompok K2 looks up the code of an active member of K1 (outside their scope)
- **THEN** they see the member's name and "K1", and no other field is in the response

#### Scenario: Other organization looks the same as unknown
- **WHEN** the code belongs to a member of another organization
- **THEN** the response is "Kode tidak ditemukan", identical to a non-existent code

#### Scenario: USER cannot look up
- **WHEN** a USER looks up a code
- **THEN** the request is rejected with 403

### Requirement: Creating a pull request
After a successful lookup, the requester SHALL be able to send a request with a destination leaf group in their scope, a move date (same rules as a direct move, checked again on approval) and an optional note (≤ 200 characters). A member SHALL have at most one pending request. A request SHALL be stored as pending and SHALL NOT move the member.

#### Scenario: Request sent
- **WHEN** an ADMIN of K2 requests member X into K2 dated today
- **THEN** a pending request exists and X is still in K1

#### Scenario: Destination outside requester's scope
- **WHEN** the requester submits a destination group outside their scope
- **THEN** the request is rejected with 404

#### Scenario: Duplicate pending
- **WHEN** member X already has a pending request
- **THEN** a new request is rejected with "Sudah ada permintaan pindah untuk anggota ini"

### Requirement: Approving and rejecting
Any user whose primary role is ADMIN or OWNER and whose scope includes the member's **current** group SHALL be able to approve or reject a pending, unexpired request, with an optional note. For an `AKTIF` member, approval SHALL perform the move exactly as a direct move (date guard re-checked, tag cleanup, `member.move` audit with `requestId`). For a member who has left, approval SHALL rejoin them into the requested group on the requested date (the rejoining rules of `member-exit-rejoin`, then tag cleanup for the new group, with `member.rejoin` audit carrying `requestId` and `toGroupId`). Either way, it SHALL happen in the same transaction as marking the request approved. If the guard fails, approval SHALL be refused and the request SHALL stay pending. Requesters SHALL NOT approve their own request unless they also have the member in scope.

#### Scenario: Kelompok admin approves
- **WHEN** an ADMIN of K1 approves the request to move X into K2
- **THEN** X's current group becomes K2, the request is approved, and both are audited

#### Scenario: Ancestor admin approves
- **WHEN** an ADMIN of desa D (an ancestor of K1) approves
- **THEN** the move happens

#### Scenario: Unrelated admin cannot decide
- **WHEN** an ADMIN of kelompok K3 (no scope over K1) tries to approve or reject
- **THEN** the response is 404 and nothing changes

#### Scenario: Member moved meanwhile
- **WHEN** X was moved elsewhere after the request was sent and an admin now approves
- **THEN** the approver must have scope over X's new current group, otherwise 404

#### Scenario: Guard fails at approval
- **WHEN** attendance was recorded for X after the requested move date, before approval
- **THEN** approval is refused with the earliest allowed date and the request stays pending

#### Scenario: Rejoin in another branch
- **WHEN** member X left K1 on 2026-04-01, an ADMIN of K2 requests X into K2 dated 2026-06-01, and an ADMIN of K1 approves
- **THEN** X becomes `AKTIF` with a new membership in K2 from 2026-06-01, keeping the same code

#### Scenario: Reject
- **WHEN** an ADMIN of K1 rejects with note "Masih aktif di sini"
- **THEN** the request is rejected, X stays in K1, and the requester sees the note

### Requirement: Cancellation and expiry
The requester SHALL be able to cancel their own pending request. A pending request older than `MOVE_REQUEST_EXPIRY_DAYS` (14) SHALL be treated as expired: it cannot be approved or rejected, it no longer blocks a new request, and it is shown as "Kedaluwarsa". No background job is required.

#### Scenario: Cancel
- **WHEN** the requester cancels
- **THEN** the request is cancelled and can no longer be approved

#### Scenario: Expired
- **WHEN** a pending request is 15 days old
- **THEN** approving it is rejected, it shows "Kedaluwarsa", and a new request for the same member is allowed

### Requirement: Request pages
`/dashboard/anggota/pindah` SHALL be available to ADMIN/OWNER with two tabs: **Masuk** (pending requests the user may decide, with member name, current group, destination, date, requester, note) and **Terkirim** (the user's own requests with status). It SHALL also have a "Minta pindah dengan kode" form. Lists SHALL be paginated with `PAGE_SIZE`. The sidebar SHALL show a count of pending incoming requests to users who may decide them. Pages SHALL be usable at mobile width.

#### Scenario: Incoming list is scoped
- **WHEN** an ADMIN of K1 opens Masuk
- **THEN** only requests for members whose current group is in K1's scope are listed

#### Scenario: USER cannot open
- **WHEN** a USER opens `/dashboard/anggota/pindah`
- **THEN** the response is 404

### Requirement: Request audit
Creating, approving, rejecting and cancelling a request SHALL each write `member_move_request.create`, `.approve`, `.reject` or `.cancel` in the same transaction, with `meta: { requestId, memberId, toGroupId, moveDate }` and `groupId` set to the member's current group. Lookups SHALL NOT be audited.

#### Scenario: Create audited
- **WHEN** a request is created
- **THEN** one `member_move_request.create` entry is written
