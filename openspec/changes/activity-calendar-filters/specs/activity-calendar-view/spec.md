# Spec Delta

## Purpose

Defines how `/kegiatan` lets a user choose which groups' activities to see, over which date range, and whether to see them as a list or on a calendar grid.

## ADDED Requirements

### Requirement: List and calendar view toggle
`/kegiatan` SHALL offer two views of the same underlying occurrence set: a list view (grouped/sorted by date) and a calendar view (a month grid with one cell per day, each cell showing a compact indicator per occurrence that day). The active view SHALL be selectable via a visible toggle and SHALL not change which occurrences are included, only their presentation. Both views SHALL show the same badges (warisan, konflik, dipindah, batal) and the same `canRecord` entry point to attendance.

#### Scenario: Switching view preserves filters
- **WHEN** a user switches from list to calendar view without changing group or date filters
- **THEN** the calendar shows exactly the occurrences that were in the list

#### Scenario: Calendar cell shows same badges as list
- **WHEN** an occurrence has a conflict and is inherited
- **THEN** its calendar cell indicator shows both the "konflik" and "warisan" markers, matching the list badges

### Requirement: Multi-group filter with descendant shortcut
The group filter SHALL allow selecting one or more groups from the set of groups visible to the user (their scope). A quick action SHALL let the user select a group together with all of its descendants in one step. Groups outside the user's scope SHALL NOT appear as selectable options. When no group is explicitly selected, the filter SHALL default to the user's own group, matching current behavior.

#### Scenario: Select a group and its descendants
- **WHEN** a user triggers the descendant-select shortcut on a daerah-level group
- **THEN** that daerah and every desa/kelompok under it become selected

#### Scenario: Out-of-scope group id in the URL is ignored
- **WHEN** the `grup` query parameter contains an id outside the user's scope
- **THEN** that id is dropped from the effective selection and does not appear in the results or cause an error

#### Scenario: No selection defaults to caller's group
- **WHEN** the page is opened with no group filter present
- **THEN** the results are the same as selecting only the user's own group

### Requirement: Date range mode toggle
`/kegiatan` SHALL offer four range modes: Hari ini (today), Minggu ini (current week, Sunday-start), Bulan ini (current calendar month), and Custom. In the first three modes the effective `from`/`to` dates SHALL be computed by the system from the current date; in Custom mode the existing manual from/to date inputs SHALL be shown and used. On first visit with no range parameters, the mode SHALL default to Minggu ini, matching current behavior. Prev/next navigation SHALL move the range by one unit of the active mode (one day, one week, or one month) and SHALL be hidden or disabled in Custom mode.

#### Scenario: Bulan ini computes calendar month bounds
- **WHEN** the mode is Bulan ini and today is 2026-09-26
- **THEN** the effective range is 2026-09-01..2026-09-30

#### Scenario: Next in week mode steps by 7 days
- **WHEN** the mode is Minggu ini showing 2026-09-20..2026-09-26 and the user clicks next
- **THEN** the range becomes 2026-09-27..2026-10-03

#### Scenario: Custom mode exposes manual inputs
- **WHEN** the mode is Custom
- **THEN** the from/to date inputs are shown and prev/next navigation is not

### Requirement: Filter state lives in the URL
The selected view, selected groups, range mode, and (in Custom mode) the manual from/to dates SHALL be represented as `searchParams` on `/kegiatan`, so the page remains a Server Component, the state survives a reload, and a link to a specific filtered view can be shared.

#### Scenario: Reload preserves filters
- **WHEN** a user reloads `/kegiatan?view=calendar&grup=3,7&range=bulan`
- **THEN** the page renders the calendar view with groups 3 and 7 selected and the current month's range
