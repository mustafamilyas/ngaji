# Spec Delta

## MODIFIED Requirements

### Requirement: Date range mode toggle
`/kegiatan` SHALL offer the presets Hari ini, Minggu ini (Sunday-start), Bulan ini, and a custom from/to, through the shared date range control (see `list-views`). Preset ranges SHALL be computed by the system around an anchor date (default today). On first visit with no range parameters, the mode SHALL default to Minggu ini. Previous/next SHALL move the range by one unit of the active preset (day, week, month); for a custom range they SHALL move it by its own length.

#### Scenario: Bulan ini computes calendar month bounds
- **WHEN** the mode is Bulan ini and today is 2026-09-26
- **THEN** the effective range is 2026-09-01..2026-09-30

#### Scenario: Next in week mode steps by 7 days
- **WHEN** the mode is Minggu ini showing 2026-09-20..2026-09-26 and the user clicks next
- **THEN** the range becomes 2026-09-27..2026-10-03

#### Scenario: Custom range steps by its length
- **WHEN** the custom range is 2026-10-01..2026-10-10 and the user clicks next
- **THEN** the range becomes 2026-10-11..2026-10-20

### Requirement: Filter state lives in the URL
The selected view, selected groups, activity-name search, range mode, anchor and (in custom mode) from/to SHALL be represented as `searchParams` on `/kegiatan`, so the page remains a Server Component, the state survives a reload, and a link to a filtered view can be shared. The list view SHALL be paginated with `PAGE_SIZE`. The name search SHALL be applied after conflict detection, so a listed occurrence keeps its *konflik* badge even if the clashing activity is filtered out.

#### Scenario: Reload preserves filters
- **WHEN** a user reloads `/kegiatan?view=calendar&grup=3,7&range=bulan`
- **THEN** the page renders the calendar view with groups 3 and 7 selected and the current month's range

#### Scenario: Search keeps conflict badge
- **WHEN** two activities conflict and the user searches for only one of them
- **THEN** that one is listed with the *konflik* badge
