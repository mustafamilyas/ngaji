# activity-schedule-print Specification

## Purpose
Defines the printable schedule at `/dashboard/kegiatan/cetak`: a read-only, print-formatted rendering of the activity list's occurrences for the same filters, printed through the browser's own print dialog.

## Requirements

### Requirement: Filter parity with the activity list
The print page SHALL accept the same filter parameters as `/dashboard/kegiatan` (`grup`, `q`, `range`, `anchor`, `from`, `to`) with the same defaults. It SHALL include exactly the occurrences the list would include for those parameters, before pagination. List-only parameters (`view`, `page`, sort) SHALL be ignored.

#### Scenario: Same occurrences as the list
- **WHEN** a user opens the print page with the same `grup`, `q` and range parameters as a list page showing 70 occurrences over two list pages
- **THEN** the print page shows all 70 occurrences on one page

#### Scenario: Defaults match the list
- **WHEN** a user opens `/dashboard/kegiatan/cetak` with no parameters
- **THEN** it shows the current week (Sunday–Saturday) for the user's own group

#### Scenario: "Cetak" carries the current filters
- **WHEN** a user on `/dashboard/kegiatan` with a group filter, search text and a month range clicks "Cetak"
- **THEN** the print page opens with those same `grup`, `q`, `range` and `anchor` values

### Requirement: Scope enforcement
The print page SHALL require a signed-in session and SHALL resolve and scope-check every group id on the server, exactly as the activity list does. Out-of-scope group ids SHALL be dropped. If no requested id is in scope, the page SHALL respond 404.

#### Scenario: Unauthenticated access
- **WHEN** a request without a session opens the print page
- **THEN** it is redirected to `/login`

#### Scenario: Out-of-scope group id is dropped
- **WHEN** `grup` holds one in-scope and one out-of-scope group id
- **THEN** only occurrences for the in-scope group appear, and nothing from the out-of-scope group's subtree is shown

#### Scenario: Only out-of-scope group ids
- **WHEN** every id in `grup` is outside the user's scope
- **THEN** the page responds 404

### Requirement: Grouped by date, ordered by time
The page SHALL show a header with the title, the selected groups' label, the date range and the print date. Occurrences SHALL be grouped under one heading per effective date, in ascending date order, with only dates that have at least one occurrence listed. Within a date, rows SHALL be ordered by effective start time, then by activity name. Each row SHALL show the time range (effective start to start + duration), activity name, owning group, effective location and effective notes. Moved occurrences SHALL carry a "Dipindah" label and cancelled occurrences a "Batal" label.

#### Scenario: Moved occurrence appears on its new date
- **WHEN** an occurrence keyed on Sunday is overridden to Monday at 19:30
- **THEN** it appears under Monday's heading at 19:30 with a "Dipindah" label, and not under Sunday

#### Scenario: Empty range
- **WHEN** no occurrences match the filters
- **THEN** the page shows "Tidak ada jadwal" instead of a table

### Requirement: Cancelled occurrences toggle
The page SHALL offer a "Tampilkan yang batal" toggle stored in the URL as `batal`. Cancelled occurrences SHALL be shown (labelled "Batal") by default and when `batal=1`, and hidden when `batal=0`. Any other value SHALL be treated as the default.

#### Scenario: Default shows cancelled
- **WHEN** the range contains a cancelled occurrence and `batal` is absent
- **THEN** that occurrence is shown with a "Batal" label

#### Scenario: Hide cancelled
- **WHEN** the same page is opened with `batal=0`
- **THEN** the cancelled occurrence is not shown, and a date whose only occurrence was cancelled gets no heading

### Requirement: Maximum printable range
The printable range SHALL be at most `PRINT_MAX_MONTHS` (3) calendar months: `to` SHALL be earlier than the date `PRINT_MAX_MONTHS` months after `from` (e.g. 2026-01-15 to 2026-04-14 is allowed, 2026-01-15 to 2026-04-15 is not). A longer range SHALL be rejected with a message asking for a shorter range, and no occurrences SHALL be loaded or shown.

#### Scenario: Three-month range is allowed
- **WHEN** a custom range from 2026-01-01 to 2026-03-31 is requested
- **THEN** all its occurrences are shown

#### Scenario: Longer range is rejected
- **WHEN** a custom range from 2026-01-01 to 2026-04-01 is requested
- **THEN** the page shows a message that the range may be at most 3 months, and no schedule table is rendered

### Requirement: Print-only presentation
When printed, the page SHALL show only the header and the schedule: the dashboard navigation shell and the page's toolbar ("Kembali", the cancelled toggle, "Cetak") SHALL be hidden. The page SHALL target A4 paper and use black-on-white, regardless of the screen theme. On screen, the "Cetak" button SHALL open the browser's print dialog. No PDF SHALL be generated on the server.

#### Scenario: Navigation hidden on paper
- **WHEN** the print page is rendered with print media
- **THEN** the sidebar, top bar and toolbar are not visible, and the header and schedule tables are

#### Scenario: Dark theme prints light
- **WHEN** a user with the dark theme prints the page
- **THEN** the printout uses dark text on a white background
