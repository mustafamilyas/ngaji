## ADDED Requirements

### Requirement: Attendance model
Attendance SHALL be a row `(occurrenceId, memberId, status ∈ {HADIR, IZIN}, note?, recordedById, recordedAt)`; `note` is the IZIN reason and SHALL be null for HADIR. Absence SHALL be represented by the absence of a row; the system SHALL never store a "not present" row.

#### Scenario: Unchecking deletes the row
- **WHEN** a member previously marked HADIR is unchecked and saved
- **THEN** their attendance row for that occurrence is deleted

### Requirement: Who may record attendance
`attendance.record` for activity A (owned by X), user at group G, target leaf group Y and date D SHALL require all of: (1) `X ∈ ancestors(G) ∪ {G}`; (2) `Y ∈ scope(G)` and Y is a leaf; (3) `X ∈ ancestors(Y) ∪ {Y}`; (4) D is a valid key per `occurrencesFor(A, D, D)` and `effectiveDate ≤ today` in Asia/Jakarta — except that a user with role ≥ ADMIN MAY set a single member's attendance for a future date from the attendance table (check-in and bulk save stay ≤ today); (5) the occurrence is not `CANCELLED`; (6) every submitted `memberId` belongs to Y's subtree, is not deleted, and is expected on D (see `statistics`).

#### Scenario: User below the owning group records
- **WHEN** a USER at kelompok K records attendance for a daerah-owned activity with `grup = K`
- **THEN** the save proceeds

#### Scenario: User above the owning group cannot record
- **WHEN** an ADMIN at daerah D records attendance for an activity owned by kelompok K under D
- **THEN** the system responds 403

#### Scenario: Non-leaf target rejected
- **WHEN** `grup` is a desa
- **THEN** the system rejects with a validation error

#### Scenario: Future date rejected for USER
- **WHEN** a USER records for D = tomorrow
- **THEN** the system rejects with a validation error

#### Scenario: ADMIN records a future IZIN
- **WHEN** an ADMIN at or below the owning group sets a member IZIN with a reason for D = next week from the attendance table
- **THEN** the row is saved with the reason

#### Scenario: Invalid rule date rejected
- **WHEN** D is a date the rule does not generate and no attendance exists for it
- **THEN** the system responds 404

#### Scenario: Foreign memberId fails the whole save
- **WHEN** the payload contains one `memberId` from sibling kelompok K2
- **THEN** the entire save is rejected and no rows are written

#### Scenario: Cancelled occurrence is read-only
- **WHEN** the occurrence has `status = CANCELLED`
- **THEN** the page shows attendance read-only and the Server Action refuses writes

### Requirement: Bulk save is transactional and audited
Saving SHALL run in one transaction: upsert `ActivityOccurrence(activityId, date)`, then upsert/delete `Attendance` per member, then write `attendance.save` with `meta = { date, groupId, set: [{memberId, status}], removed: [memberId] }`.

#### Scenario: Audit written with the save
- **WHEN** a save marks two members HADIR, one IZIN and removes one
- **THEN** exactly one `attendance.save` entry lists the three set and the one removed

### Requirement: Attendance page
`/dashboard/kegiatan/[id]/[tanggal]` SHALL show a table of the expected members on that date across every leaf group in the user's scope to which the activity applies (users above the owning group: the owning group's subtree, read-only). Columns: name (with group name when more than one group), status (Hadir / Izin / Belum absen), reason, and actions (Hadir / Izin toggles usable with one tap each on a 375 px wide screen). The table SHALL sort by name and by status and filter by name, status and group; `?grup=Y` only preselects the group filter.

#### Scenario: Toggle saves immediately
- **WHEN** a user taps "Hadir" on a member, then taps it again
- **THEN** the member is saved HADIR, then the row is deleted, each with its own `attendance.save` audit entry

#### Scenario: Reason on IZIN
- **WHEN** a member is marked Izin and a reason is entered
- **THEN** the reason is saved with the row; switching the member to Hadir clears it

#### Scenario: Read-only above the owning group
- **WHEN** an ADMIN at daerah D opens an occurrence of an activity owned by kelompok K under D
- **THEN** the table lists K's expected members and their status without action buttons
