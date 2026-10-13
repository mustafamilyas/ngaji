# Member Views Specification

## Purpose

Lets any account save a named member list (rules, sort, grouping, columns) for its own group and lets everyone in that exact group reopen it.

## Requirements

### Requirement: View fields
A member view SHALL have a `name` (1–`MAX_NAME_LENGTH` characters after trimming, unique among non-deleted views of the same group, case-insensitive), an owning `groupId`, an `ownerId`, a `createdById`, a `source` (only `member` is accepted), a `visibility` (only `GROUP` is accepted) and a `definition` (see `member-view-query`). The owning group SHALL be the creator's group at creation time and SHALL NOT be taken from the client.

#### Scenario: Group comes from the session
- **WHEN** a user in kelompok K submits a new view with `groupId` of another group in the payload
- **THEN** the view is saved with `groupId = K`

#### Scenario: Duplicate name rejected
- **WHEN** a user saves a view named "Remaja Aktif" and the group already has a non-deleted view named "remaja aktif"
- **THEN** the save is rejected with a validation error and nothing is written

#### Scenario: Name of a deleted view can be reused
- **WHEN** the only view named "Remaja Aktif" in the group is soft-deleted and a user saves a new view with that name
- **THEN** the save succeeds

#### Scenario: Unsupported source or visibility rejected
- **WHEN** a save request carries `source = "attendance"` or `visibility = "PRIVATE"`
- **THEN** the save is rejected with a validation error

### Requirement: Any account can create a view
Every active user (USER, ADMIN, OWNER) SHALL be able to create a view; the creator becomes its owner.

#### Scenario: USER creates a view
- **WHEN** a USER in kelompok K saves a new view
- **THEN** the view is created with `groupId = K`, `ownerId = createdById = that user`

#### Scenario: Inactive user cannot create
- **WHEN** a deactivated user's request to create a view arrives
- **THEN** it is rejected as unauthenticated and nothing is written

### Requirement: Views are visible to the same group only
A view SHALL be listed and opened only by users whose group is exactly the view's group. Users in an ancestor group, a descendant group or another branch SHALL receive 404 for the view and SHALL NOT see it in `/dashboard/tampilan`. Soft-deleted views SHALL behave as nonexistent.

#### Scenario: Same-group user sees the view
- **WHEN** user B in kelompok K opens a view created by user A in kelompok K
- **THEN** the view and its results are shown

#### Scenario: Ancestor user denied
- **WHEN** an OWNER of the root group opens a view owned by kelompok K
- **THEN** the response is 404

#### Scenario: Descendant user denied
- **WHEN** a user in kelompok K (child of desa D) opens a view owned by desa D
- **THEN** the response is 404

#### Scenario: List shows only own group's views
- **WHEN** a user in desa D opens `/dashboard/tampilan`
- **THEN** only non-deleted views with `groupId = D` are listed

#### Scenario: Deleted view
- **WHEN** a user opens a soft-deleted view by its id
- **THEN** the response is 404

### Requirement: Only the owner edits or deletes
Only the view's owner SHALL be able to update (name, definition) or soft-delete it. Other users in the group SHALL get 403 when attempting to and SHALL NOT see the edit or delete controls.

#### Scenario: Owner updates
- **WHEN** the owner saves changes to the definition
- **THEN** the view is updated

#### Scenario: Other group member update denied
- **WHEN** another user in the same group (even an ADMIN) submits an update while the owner is still active and in that group
- **THEN** the request fails with 403 and nothing is written

#### Scenario: Other group member delete denied
- **WHEN** a non-owner in the same group submits a delete
- **THEN** the request fails with 403 and the view remains

#### Scenario: Owner deletes
- **WHEN** the owner confirms delete in the danger zone
- **THEN** `deletedAt` is set and the view disappears from `/dashboard/tampilan`

### Requirement: Takeover of orphaned views
A view SHALL be *orphaned* when its owner is deactivated or the owner's current group is not the view's group. An ADMIN or OWNER whose group is exactly the view's group SHALL be able to take over an orphaned view, which sets `ownerId` to them; after that the normal owner rules apply. Takeover SHALL be denied for a non-orphaned view and for USER role.

#### Scenario: Admin takes over after owner moved
- **WHEN** the owner is moved to another group and an ADMIN of the view's group clicks "Ambil alih"
- **THEN** `ownerId` becomes that ADMIN and they can edit and delete the view

#### Scenario: Admin takes over after owner deactivated
- **WHEN** the owner is deactivated and an OWNER of the view's group takes over
- **THEN** `ownerId` becomes that OWNER

#### Scenario: Takeover of active owner's view denied
- **WHEN** an ADMIN of the group tries to take over a view whose owner is active and still in the group
- **THEN** the request fails with 403

#### Scenario: USER cannot take over
- **WHEN** a USER of the group tries to take over an orphaned view
- **THEN** the request fails with 403

#### Scenario: Moved owner loses access
- **WHEN** the previous owner, now in another group, opens the view
- **THEN** the response is 404

### Requirement: Unsaved edits and saving
Opening a view SHALL show its saved definition. Changes to rules, sort, grouping or columns SHALL apply immediately as an unsaved draft kept in the URL, marked "Belum disimpan", without writing to the database. The owner SHALL be able to "Simpan" (overwrite) or "Batalkan" (back to saved). Any user in the group SHALL be able to "Simpan sebagai baru", which creates a new view they own. A draft in the URL SHALL be validated exactly like a saved definition.

#### Scenario: Draft does not persist
- **WHEN** a non-owner changes the sort and reloads the page with the same URL
- **THEN** the changed sort is shown, and the saved view is unchanged for other users

#### Scenario: Non-owner saves as new
- **WHEN** a non-owner clicks "Simpan sebagai baru" with name "Pemuda Desa"
- **THEN** a new view owned by them is created in their group with the draft definition

#### Scenario: Owner overwrites
- **WHEN** the owner clicks "Simpan" on a draft
- **THEN** the view's definition is replaced and the draft marker disappears

#### Scenario: Tampered draft
- **WHEN** the URL draft is not valid (malformed or fails the definition schema)
- **THEN** the saved definition is shown with a generic notice that the changes could not be read

### Requirement: View pages
The app SHALL provide `/dashboard/tampilan` (list of the group's views: name, owner, last updated; search by name; paginated `PAGE_SIZE`; "Buat tampilan"), `/dashboard/tampilan/baru` (start from an empty definition) and `/dashboard/tampilan/[id]` (header with name and owner, filter bar, "Tampilan" menu for group-by/sort/columns, results, danger zone for the owner). A sidebar item "Tampilan" SHALL be visible to all users. Pages SHALL be usable at mobile width.

#### Scenario: Owner controls hidden from others
- **WHEN** a non-owner opens `/dashboard/tampilan/[id]`
- **THEN** "Simpan", rename and the danger zone are not rendered; "Simpan sebagai baru" is

#### Scenario: New view defaults
- **WHEN** a user opens `/dashboard/tampilan/baru`
- **THEN** the draft has no rules except status is any of `AKTIF`, sort by name ascending, no grouping and the default member columns
