# Spec Delta

## MODIFIED Requirements

### Requirement: Grouped by date, ordered by time
The page SHALL show a header with the signed-in user's organization name, the title, the selected groups' label, the date range and the print date. Occurrences SHALL be shown in a single table for the whole range, with the columns Tanggal, Jam, Kegiatan, Grup, Lokasi and Keterangan, in ascending effective date order. Only dates that have at least one occurrence SHALL appear. The Tanggal cell (weekday and date) SHALL appear once per date, spanning that date's rows, and a visible rule SHALL separate dates. Within a date, rows SHALL be ordered by effective start time, then by activity name. Each row SHALL show the time range (effective start to start + duration), activity name, owning group, effective location and effective notes. Moved occurrences SHALL carry a "Dipindah" label and cancelled occurrences a "Batal" label. The table header row SHALL repeat at the top of every printed page, and a row SHALL NOT be split across pages.

#### Scenario: Moved occurrence appears on its new date
- **WHEN** an occurrence keyed on Sunday is overridden to Monday at 19:30
- **THEN** it appears in Monday's rows at 19:30 with a "Dipindah" label, and not in Sunday's rows

#### Scenario: Date shown once
- **WHEN** a date has three occurrences
- **THEN** the table shows that date in one Tanggal cell spanning the three rows

#### Scenario: Single header row
- **WHEN** the range spans seven dates with occurrences
- **THEN** the page renders one table with one header row, not one table per date

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
- **THEN** the cancelled occurrence is not shown, and a date whose only occurrence was cancelled has no rows in the table

### Requirement: Print-only presentation
When printed, the page SHALL show only the header and the schedule table: the dashboard navigation shell and the page's toolbar ("Kembali", the cancelled toggle, "Cetak") SHALL be hidden. The page SHALL target A4 paper, use black-on-white regardless of the screen theme, and use compact type and cell spacing so a typical week fits on one page. On screen, the "Cetak" button SHALL open the browser's print dialog. No PDF SHALL be generated on the server.

#### Scenario: Navigation hidden on paper
- **WHEN** the print page is rendered with print media
- **THEN** the sidebar, top bar and toolbar are not visible, and the header and schedule table are

#### Scenario: Dark theme prints light
- **WHEN** a user with the dark theme prints the page
- **THEN** the printout uses dark text on a white background

#### Scenario: Typical week on one page
- **WHEN** a week with 15 occurrences, each with a Keterangan that wraps to at most two printed lines, is printed on A4 portrait
- **THEN** it fits on one page
