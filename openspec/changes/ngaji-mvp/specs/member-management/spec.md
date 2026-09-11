## ADDED Requirements

### Requirement: Members live only in leaf groups
A member SHALL belong to exactly one group whose depth equals the last level's depth. Creating or moving a member into a non-leaf group SHALL be rejected server-side.

#### Scenario: Create in leaf group
- **WHEN** a USER at kelompok K creates a member with `groupId = K`
- **THEN** the member is stored with `createdById` = the user, `joinedAt` defaulting to today

#### Scenario: Create in non-leaf group rejected
- **WHEN** a request creates a member with `groupId` of a desa (non-leaf)
- **THEN** the system rejects with a validation error

### Requirement: Member fields and validation
A member SHALL have `name`, `birthPlace`, `birthDate`, `sex` (L/P), `address`, `phone` (not unique), `maritalStatus`, `workStatus`, optional `email`, `status` (AKTIF/KELUAR/PINDAH/MENINGGAL), `joinedAt`, optional `exitedAt`. The same zod schema SHALL be used by the form and the Server Action. `exitedAt` SHALL be required when `status ≠ AKTIF`.

#### Scenario: Exit without date rejected
- **WHEN** status is set to KELUAR with `exitedAt` empty
- **THEN** the system rejects with a validation error

#### Scenario: Shared phone allowed
- **WHEN** two members in one family are created with the same phone number
- **THEN** both are stored

### Requirement: Leaving is a status change
Leaving, moving away or death SHALL be recorded by changing `status` and `exitedAt`; the member row SHALL remain and keep its attendance history. `PINDAH` SHALL NOT move the row to another group (a new member row is created at the destination; move history is non-MVP).

#### Scenario: Mark as KELUAR
- **WHEN** a member's status is changed to KELUAR with `exitedAt` = today
- **THEN** the member is excluded from active-member statistics but their past attendance still appears in occurrence statistics for dates before `exitedAt`

### Requirement: Soft delete
Deleting a member SHALL set `deletedAt`; it is intended for data-entry errors and is distinct from `status`. Every member query SHALL exclude rows with `deletedAt != null`.

#### Scenario: Deleted member disappears everywhere
- **WHEN** a member is soft-deleted
- **THEN** they do not appear in lists, search, attendance pages or statistics

### Requirement: List, search, filter, pagination
The member list SHALL be scope-filtered, searchable by name (case-insensitive substring), filterable by group in scope and by status, and paginated with `PAGE_SIZE` (constant, 50) via `?page=`.

#### Scenario: Third page
- **WHEN** 120 members match and `?page=3` is requested
- **THEN** members 101–120 are shown with the total count 120

#### Scenario: Filter by group outside scope
- **WHEN** the `grup` filter names a group outside scope
- **THEN** the system responds 404
