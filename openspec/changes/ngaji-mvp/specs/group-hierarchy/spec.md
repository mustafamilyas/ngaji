## ADDED Requirements

### Requirement: Fixed, ordered levels
The organization SHALL have a fixed list of levels identified by `depth` (0 = root), each with a renameable name. Groups MUST be created only at `depth = parent.depth + 1`; a root group has `depth = 0` and no parent.

#### Scenario: Create a child at the next depth
- **WHEN** an ADMIN creates a sub-group under a group with depth 2
- **THEN** the new group is stored with depth 3 and `parentId` set to that group

#### Scenario: Skipping a level is rejected
- **WHEN** a request attempts to create a group with depth 3 under a group with depth 1
- **THEN** the system rejects the request with a validation error

#### Scenario: Rename a level
- **WHEN** an OWNER whose group has depth 0 renames level 2 from "desa" to "kelurahan"
- **THEN** the level row is updated and all groups at depth 2 display the new name

#### Scenario: Non-root OWNER cannot rename levels
- **WHEN** an OWNER whose group has depth 1 attempts to rename a level
- **THEN** the system responds 403 (a role/position check, not a specific out-of-scope entity — DESIGN.md §4.2's reason for 404 doesn't apply here)

### Requirement: Materialized path
Every group SHALL store `path` = parent path + own id + `/` (e.g. `"1/5/12/"`), written in the same transaction as the insert. A group's descendants SHALL be all groups whose `path` starts with the group's `path`.

#### Scenario: Path includes own id and trailing slash
- **WHEN** group 12 is created under group 5 whose path is `"1/5/"`
- **THEN** group 12's path is `"1/5/12/"`

#### Scenario: Prefix match does not overreach
- **WHEN** descendants of group 5 (`"1/5/"`) are queried
- **THEN** group 50 with path `"1/50/"` is not included

### Requirement: Sibling names are unique
Group names SHALL be unique among non-deleted siblings (same `parentId`), enforced server-side.

#### Scenario: Duplicate sibling name rejected
- **WHEN** a group named "Kelompok A" already exists under parent 7 and a user creates another "Kelompok A" under parent 7
- **THEN** the system rejects the request with a validation error

### Requirement: Soft delete of empty groups only
Groups SHALL be soft-deleted (`deletedAt`), never hard-deleted, and only when they have no non-deleted children, members, activities, or users. Every group query SHALL exclude rows with `deletedAt != null`.

#### Scenario: Delete an empty group
- **WHEN** an ADMIN deletes a group in scope with no children, members, activities or users
- **THEN** `deletedAt` is set and the group no longer appears in the tree

#### Scenario: Delete a non-empty group is rejected
- **WHEN** an ADMIN deletes a group that still has one active member
- **THEN** the system rejects with a message naming what is still attached

#### Scenario: Deleted groups are invisible
- **WHEN** any list or detail query runs for groups
- **THEN** groups with `deletedAt` set are not returned
