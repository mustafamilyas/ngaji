# Spec Delta

## MODIFIED Requirements

### Requirement: Default range and scope
Every statistic SHALL be scope-filtered and bounded by a date range defaulting to the last `DEFAULT_STATS_RANGE_DAYS` (constant, 30) days, inclusive of today. Statistics SHALL be computed for a single scope group (default the user's own group); the group filter on `/dashboard/statistik` SHALL therefore be single-select. The member tab has no date range.

#### Scenario: Default range applied
- **WHEN** `/dashboard/statistik` is opened without parameters
- **THEN** the range is today−29 .. today

### Requirement: Participation statistics
The participation tab SHALL show, per member: the number of occurrences applying to them (activities of their group and its ancestors, not cancelled) with `effectiveDate` in `[max(from, joinedAt), min(to, exitedAt ?? today)]`, hadir, izin, % hadir; sortable by any column, searchable by member name, and paginated with `PAGE_SIZE` after sorting. The same figures SHALL appear on the member detail page.

#### Scenario: Sort by attendance
- **WHEN** the user sorts by % hadir descending
- **THEN** rows are ordered accordingly across all pages, and the view returns to page 1
