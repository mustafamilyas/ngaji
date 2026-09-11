## ADDED Requirements

### Requirement: Every mutation is audited in the same transaction
Every Server Action that writes SHALL call `audit(tx, { action, entity, entityId, groupId, before, after, meta })` with the same Prisma transaction client. If the audit write fails the mutation SHALL roll back. `AuditLog` SHALL be append-only: no update or delete path exists in the application.

#### Scenario: Audit failure rolls back
- **WHEN** the audit insert throws during a member update
- **THEN** the member row is unchanged

#### Scenario: Group create audited
- **WHEN** a group is created
- **THEN** an entry with `action = "group.create"`, `entity = "Group"`, `entityId`, `groupId` and `after` snapshot exists

### Requirement: Logged actions
The following actions SHALL be logged: `auth.login`, `auth.login_failed`, `auth.logout`; `user.create`, `user.update_role`, `user.move`, `user.set_active`, `user.reset_password`, `user.change_password`; `group.create/update/delete`, `level.rename`; `member.create/update/delete`; `activity.create/update/delete/split`; `occurrence.override`; `attendance.save`.

#### Scenario: Split records lineage
- **WHEN** an activity is split at date X
- **THEN** an `activity.split` entry has `meta = { fromActivityId, toActivityId, fromDate: X }`

### Requirement: Redaction
`before`/`after` SHALL never contain `passwordHash` or any field whose name starts with `password`; the helper SHALL strip them regardless of caller. Temporary and new passwords SHALL never appear in `meta`.

#### Scenario: User snapshot redacted
- **WHEN** `user.reset_password` is logged with the full user row as `after`
- **THEN** the stored `after` has no `passwordHash` key

### Requirement: Context captured
Each entry SHALL store `actorId` (null only for failed logins with unknown username), `ip`, `userAgent`, `createdAt`.

#### Scenario: Failed login unknown user
- **WHEN** a login fails for a non-existent username
- **THEN** the entry has `actorId = null` and `meta.username` set

### Requirement: Viewer
`/audit` SHALL be available to OWNER only and SHALL show entries whose `groupId` is in scope (plus the OWNER's own auth entries), newest first, filterable by action, actor and date range, paginated by `PAGE_SIZE`.

#### Scenario: ADMIN denied
- **WHEN** an ADMIN opens `/audit`
- **THEN** the system responds 404

#### Scenario: Scope filter
- **WHEN** an OWNER at daerah D opens `/audit`
- **THEN** entries for groups under another daerah are not shown

### Requirement: Application logs contain no PII
Server stdout/stderr logs SHALL contain identifiers only — never member names, addresses, phone numbers, passwords or tokens. Errors shown to users SHALL be generic; stack traces SHALL go to server logs only.

#### Scenario: Unexpected error
- **WHEN** a Server Action throws an unexpected error
- **THEN** the user sees a generic message and the stack trace appears only in server logs
