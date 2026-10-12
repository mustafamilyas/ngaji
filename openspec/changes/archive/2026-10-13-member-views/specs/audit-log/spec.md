# Spec Delta

## ADDED Requirements

### Requirement: Member view actions are logged
The following member view mutations SHALL be audited in the same transaction, with entity `MemberView` and `groupId` = the view's group:
- `member_view.create` — `after` = name, source, visibility and definition.
- `member_view.update` — `before` / `after` = name and definition.
- `member_view.delete` — `before` = the view snapshot.
- `member_view.transfer` — `meta = { fromOwnerId, toOwnerId }`.
Opening or listing views and unsaved drafts SHALL NOT be audited.

#### Scenario: Update audited with before and after
- **WHEN** the owner saves a changed definition
- **THEN** one `member_view.update` entry holds the old and new definitions

#### Scenario: Transfer audited
- **WHEN** an ADMIN takes over an orphaned view
- **THEN** a `member_view.transfer` entry records the previous and new owner ids

#### Scenario: Audit failure rolls back
- **WHEN** the audit insert throws while creating a view
- **THEN** no `MemberView` row is written

#### Scenario: Draft not audited
- **WHEN** a user changes rules without saving
- **THEN** no audit entry is written
