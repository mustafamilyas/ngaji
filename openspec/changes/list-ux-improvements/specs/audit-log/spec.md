# Spec Delta

## MODIFIED Requirements

### Requirement: Viewer
`/dashboard/audit` SHALL be available to OWNER only and SHALL show entries whose `groupId` is in scope (plus the OWNER's own auth entries), newest first, filterable by group (one or more, each including descendants; selecting groups excludes group-less `auth.*` entries), date range (presets or custom; default all time), action and actor, paginated by `PAGE_SIZE`.

#### Scenario: ADMIN denied
- **WHEN** an ADMIN opens `/dashboard/audit`
- **THEN** the system responds 404

#### Scenario: Scope filter
- **WHEN** an OWNER at daerah D opens `/dashboard/audit`
- **THEN** entries for groups under another daerah are not shown

#### Scenario: Group filter
- **WHEN** an OWNER filters by kelompok K
- **THEN** only entries scoped to K are shown, and login/logout entries are not
