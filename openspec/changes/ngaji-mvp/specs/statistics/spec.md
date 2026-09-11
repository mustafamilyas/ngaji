## ADDED Requirements

### Requirement: Expected members are time-aware
`expected(occurrence, groupId)` in `lib/stats.ts` SHALL return members in the group's subtree with `deletedAt = null`, `joinedAt ≤ effectiveDate`, and (`status = AKTIF` or `exitedAt > effectiveDate`). All statistics and the attendance page SHALL use this single function.

#### Scenario: Joined after the date
- **WHEN** a member has `joinedAt = 2026-09-15` and the occurrence date is 2026-09-10
- **THEN** the member is not expected

#### Scenario: Left after the date
- **WHEN** a member is KELUAR with `exitedAt = 2026-09-20` and the occurrence date is 2026-09-10
- **THEN** the member is expected

#### Scenario: Left with no exit date
- **WHEN** a member is KELUAR and `exitedAt` is null
- **THEN** the member is not expected on any date

### Requirement: Default range and scope
Every statistic SHALL be scope-filtered and bounded by a date range defaulting to the last `DEFAULT_STATS_RANGE_DAYS` (constant, 30) days.

#### Scenario: Default range applied
- **WHEN** `/statistik` is opened without parameters
- **THEN** the range is today−30 .. today

### Requirement: Member statistics
The members tab SHALL show, for `status = AKTIF` and non-deleted members in scope: total; by sex; by marital status; by work status; by age bracket computed from `birthDate` using `AGE_BRACKETS` in `lib/constants.ts` (0–5, 6–12, 13–18, 19–59, ≥60); and by direct sub-group.

#### Scenario: Age bracket boundary
- **WHEN** a member turns 60 today
- **THEN** they are counted in the ≥60 bracket

### Requirement: Activity statistics
The activities tab SHALL show, per non-cancelled occurrence with `effectiveDate ≤ today` in range: hadir, izin, absent (= expected − hadir − izin), expected, % hadir; a trend of % hadir by date; and a breakdown by direct sub-group.

#### Scenario: Cancelled excluded
- **WHEN** an occurrence in range is CANCELLED
- **THEN** it is not counted in any activity statistic

#### Scenario: Percentage cannot exceed 100
- **WHEN** a member who attended has since left
- **THEN** `expected` for that past date still includes them and % hadir ≤ 100

### Requirement: Participation statistics
The participation tab SHALL show, per member: the number of occurrences applying to them (activities of their group and its ancestors, not cancelled) with `effectiveDate` in `[max(from, joinedAt), min(to, exitedAt ?? today)]`, hadir, izin, % hadir; sortable by any column. The same figures SHALL appear on the member detail page.

#### Scenario: Sort by attendance
- **WHEN** the user sorts by % hadir descending
- **THEN** rows are ordered accordingly

### Requirement: Dashboard
`/` SHALL show a summary of the member and activity statistics for the user's scope and the occurrences of the next 7 days.

#### Scenario: Upcoming list
- **WHEN** the dashboard loads on 2026-09-11
- **THEN** occurrences with `effectiveDate` in 2026-09-11..2026-09-17 are listed
