# Spec Delta

## Purpose

Lets an organization's root OWNER manage organization-wide settings (name, timezone, level names) in one place, and defines how the organization's timezone drives "today" across the app.

## ADDED Requirements

### Requirement: Settings page for the root OWNER
`/dashboard/pengaturan` SHALL let an OWNER whose own group is the root (depth 0) of their organization change the organization name (1–100 characters after trimming), the timezone (WIB `Asia/Jakarta`, WITA `Asia/Makassar`, WIT `Asia/Jayapura`) and each level name. The level renaming formerly at `/dashboard/pengaturan/jenjang` SHALL be part of this page, and the old URL SHALL redirect to it. The navigation SHALL show "Pengaturan" only to root OWNERs.

#### Scenario: Rename the organization
- **WHEN** a root OWNER changes the name to "Majelis An-Nur" and saves
- **THEN** the sidebar, document titles and print header show "Majelis An-Nur" on the next request

#### Scenario: Old level URL
- **WHEN** a root OWNER opens `/dashboard/pengaturan/jenjang`
- **THEN** they are redirected to `/dashboard/pengaturan`

#### Scenario: Empty name rejected
- **WHEN** a root OWNER saves a name of only spaces
- **THEN** the form shows an error and the name is unchanged

### Requirement: Only the root OWNER may change settings
Changing organization settings SHALL require role OWNER and an own group at depth 0. Any other user SHALL see the existing "Anda tidak memiliki izin mengakses halaman ini." message on the page, and any settings server action they call SHALL fail without writing. The settings SHALL always be those of the caller's own organization.

#### Scenario: ADMIN at the root
- **WHEN** an ADMIN whose group is the root opens `/dashboard/pengaturan`
- **THEN** they see the no-permission message and no form

#### Scenario: OWNER below the root
- **WHEN** an OWNER of a daerah group calls the update-settings action directly
- **THEN** the action fails, the organization is unchanged, and no `organization.update` entry is written

#### Scenario: Cannot change another organization
- **WHEN** a root OWNER of org A posts the settings form with any extra field naming org B
- **THEN** only org A is updated

### Requirement: Settings changes are audited
Every settings change SHALL write, in the same transaction, an audit entry (`organization.update` for name/timezone, `level.rename` for levels) with the before and after values, scoped to the organization's root group.

#### Scenario: Timezone change audited
- **WHEN** a root OWNER changes the timezone from `Asia/Jakarta` to `Asia/Makassar`
- **THEN** an `organization.update` entry with before `Asia/Jakarta` and after `Asia/Makassar` appears in that organization's audit log

### Requirement: Organization timezone drives "today"
Every calculation of "today" or of the calendar date of an instant for a signed-in user SHALL use their organization's timezone: the attendance date limit (≤ today), default date ranges and anchors, statistics ranges, `joinedAt` defaults, and audit/respondent timestamp display. Stored dates (`YYYY-MM-DD`) and times (`HH:mm`) SHALL NOT be converted when the timezone changes.

#### Scenario: Attendance limit in WIT
- **WHEN** it is 23:30 on 2026-10-24 in Jakarta (01:30 on 2026-10-25 in Jayapura) and a user of an org with timezone `Asia/Jayapura` records attendance for 2026-10-25
- **THEN** the date is accepted as today

#### Scenario: Same instant, WIB org
- **WHEN** at the same instant a user of an org with timezone `Asia/Jakarta` records attendance for 2026-10-25 without ≥ ADMIN future-date rights
- **THEN** the date is rejected as a future date

#### Scenario: Activity times unchanged
- **WHEN** an org switches from WIB to WITA
- **THEN** an activity stored at `19:30` still shows `19:30`

### Requirement: Logo placeholder
Organizations SHALL have an optional `logoUrl` value. It SHALL NOT be editable or rendered anywhere in this change; branded surfaces SHALL keep showing the Dahan logo mark.

#### Scenario: Logo not shown
- **WHEN** an organization has a `logoUrl` set directly in the database
- **THEN** the sidebar and login still show the Dahan logo mark
