# Spec Delta

## Purpose

Keeps dashboard list pages usable on phones: records appear on the first screen, filters stay reachable without crowding the page, and read-only text stays legible.

## ADDED Requirements

### Requirement: Secondary filters are collapsed on phones
Below the `lg` breakpoint, the Anggota, Kegiatan, Survei, Pengguna, and Audit list pages SHALL show only their primary controls inline, plus one "Filter" button. The search field, where the page has one, is a primary control; on Kegiatan the view switch and date navigator are also primary. All other filters, the sort control, and the column picker SHALL be in a bottom panel opened by that button. From `lg` upward all controls SHALL appear inline, as they do today. Pages with no secondary controls SHALL NOT show the button.

#### Scenario: Anggota on a phone
- **WHEN** a user opens `/dashboard/anggota` at 375px wide
- **THEN** the search field and "Filter" button appear on one row, and the group, tag, status, sort, and column controls are not visible until the panel is opened

#### Scenario: Kegiatan keeps its date navigator
- **WHEN** a user opens `/dashboard/kegiatan` at 375px wide
- **THEN** the date navigator stays visible outside the panel

#### Scenario: Desktop layout unchanged
- **WHEN** a user opens a list page at 1280px wide
- **THEN** every filter control is inline and no "Filter" button is shown

#### Scenario: Page with search only
- **WHEN** a user opens `/dashboard/tampilan` at 375px wide
- **THEN** no "Filter" button is shown

### Requirement: Collapsed filters stay visible as state
The "Filter" button SHALL show how many secondary filters are active, and SHALL look active when that number is above zero. Search text and a non-default sort SHALL NOT count. The reset action SHALL be available in the panel whenever the list is filtered.

#### Scenario: Two active filters
- **WHEN** the URL applies a status filter and a group filter
- **THEN** the button reads "Filter (2)" in its active style

#### Scenario: Search only
- **WHEN** only the search text is set
- **THEN** the button shows no count

#### Scenario: Reset from the panel
- **WHEN** a user taps "Reset" in the panel
- **THEN** all filters are cleared and the list shows every record in scope

### Requirement: Filter panel keeps existing filter behaviour
Controls in the panel SHALL apply on change, using the same URL parameters as the inline controls, and SHALL return the list to page 1. The panel SHALL stay open across those changes until the user closes it. It SHALL close on its close button, on tapping the backdrop, or on Escape, and focus SHALL return to the "Filter" button. Group filter ids from the URL SHALL still be validated on the server.

#### Scenario: Change a filter in the panel
- **WHEN** a user on page 3 picks a status in the panel
- **THEN** the URL gains that `status`, loses `page`, the list updates, and the panel stays open

#### Scenario: Escape closes the panel
- **WHEN** the panel is open and the user presses Escape
- **THEN** the panel closes and focus is on the "Filter" button

#### Scenario: Group outside scope
- **WHEN** a filter URL names a group outside the user's scope on a page where that responds 404
- **THEN** the system still responds 404

### Requirement: Stat tiles are compact on phones
Below `lg`, stat tiles SHALL use a compact layout and SHALL hide their hint lines. From `lg` upward they SHALL look as they do today.

#### Scenario: Tile hint hidden
- **WHEN** a user opens `/dashboard/anggota` at 375px wide
- **THEN** the tiles show label and value, without the "Keluar, pindah, meninggal" hint

### Requirement: First record is reached without scrolling far
At phone size with seed data (the audit measures at 360×740, which is narrower and so stricter than a 375×812 phone), the first record on the Anggota, Kegiatan, Survei, Pengguna, and Audit list pages SHALL start no more than 600px from the top of the page, with the filter panel closed.

#### Scenario: Anggota first row
- **WHEN** `/dashboard/anggota` loads at 360×740 or 375×812
- **THEN** the first member row starts at or above 600px

### Requirement: Read-only dashboard text is legible
Below `xl`, visible read-only text in the dashboard SHALL be at least 14px, including text in dialogs and popups. Exempt elements SHALL be marked explicitly in the markup; chart text is exempt. Print output, the landing page, and text sizes from `xl` upward SHALL NOT change.

#### Scenario: Card label on a phone
- **WHEN** a member card is shown at 375px wide
- **THEN** its field labels are at least 14px

#### Scenario: Print unchanged
- **WHEN** the schedule is printed with `pnpm audit:print`
- **THEN** every scenario stays within its page budget

#### Scenario: Desktop unchanged
- **WHEN** a dashboard page is shown at 1280px wide
- **THEN** `text-xs` text is still 12px

### Requirement: The viewport audit guards these rules
`pnpm audit:viewport` SHALL exit non-zero when, below `xl`, visible read-only text under 14px is not marked exempt, or when a first record on a measured list page starts below the 600px limit at phone size.

#### Scenario: Unmarked small text
- **WHEN** an audited page renders unmarked 12px text at phone width
- **THEN** the audit reports a finding and exits 1

#### Scenario: Exempt text
- **WHEN** small text is marked exempt
- **THEN** the audit reports no finding for it

### Requirement: Tampilan edits apply when the panel closes
On the Tampilan page, edits made inside a panel (a filter chip's popover, the phone "Filter" sheet, or the "Tampilan" menu) SHALL NOT change the result while the panel is open. They SHALL apply, as one change to the result, when the user presses "Terapkan" or closes the panel. "Terapkan" SHALL close the panel. Single-click controls outside a panel (a chip's remove button, the DAN/ATAU toggle between chips, and "Tambah filter") SHALL apply at once; "Tambah filter" opens the new filter's popover, and the new filter applies when that popover closes. "Hapus filter" inside a chip's popover SHALL remove the filter and close the popover. Applying SHALL NOT save the view; saving stays with "Simpan".

#### Scenario: Editing a rule does not change the result
- **WHEN** a user changes a rule's value in a filter chip's popover
- **THEN** the URL and the result stay the same until "Terapkan" is pressed or the popover closes

#### Scenario: Terapkan applies and closes
- **WHEN** a user presses "Terapkan" after editing
- **THEN** the URL gains the new `d`, the result updates, the popover closes, and the view still shows "Belum disimpan"

#### Scenario: Closing applies
- **WHEN** a user edits sorting in the "Tampilan" menu and closes it with Escape
- **THEN** the new sort applies

#### Scenario: Remove chip applies at once
- **WHEN** a user presses a chip's remove button
- **THEN** that filter is removed from the result at once

### Requirement: ADMIN and OWNER can record attendance for future dates everywhere
A user whose primary role is ADMIN or OWNER SHALL be able to record attendance for a valid future occurrence through every attendance writer: the attendance table, the check-in page (`/dashboard/kegiatan/[id]/[tanggal]/absen`), and the bulk save. All other rules (scope, leaf group, expected members, not cancelled) SHALL still apply. A USER, including one with an extra ADMIN role, SHALL stay limited to today or earlier. On a future date the check-in page SHALL show ADMIN and OWNER the form with a notice that the date has not happened yet, and SHALL show a USER the closed message "Tanggal ini belum terjadi; absensi belum bisa diisi."

#### Scenario: ADMIN checks in for next week
- **WHEN** an ADMIN in the owning group checks in a member for a valid occurrence seven days ahead
- **THEN** the member is recorded HADIR and the action is audited

#### Scenario: OWNER opens a future check-in page
- **WHEN** an OWNER opens the check-in page for a future occurrence
- **THEN** the form is shown with the "belum terjadi" notice

#### Scenario: USER stays at today or earlier
- **WHEN** a USER checks in, or opens the check-in page, for a future occurrence
- **THEN** the server rejects the check-in and the page shows the closed message

### Requirement: Isi absensi buttons follow the future-date rule
On the activity page, the header button SHALL open today's occurrence ("Isi absensi hari ini") when one is not cancelled. Otherwise, for a user whose primary role is ADMIN or OWNER, it SHALL open the next non-cancelled occurrence in the schedule horizon, labelled "Isi absensi · <weekday>, <date>"; a USER SHALL see no header button. The Jadwal tab rows and the Kegiatan list's row action SHALL read "Isi absensi" for every non-cancelled occurrence the user may record under the same date rule, and "Lihat" otherwise; on the Jadwal tab only today's row button is filled, and future ones are outlined. Earlier occurrences SHALL stay editable for every role in scope.

#### Scenario: ADMIN with nothing today
- **WHEN** an ADMIN opens an activity whose next occurrence is in two days
- **THEN** the header button reads "Isi absensi · <weekday>, <date>" and opens that occurrence

#### Scenario: USER with nothing today
- **WHEN** a USER opens the same activity
- **THEN** no header "Isi absensi" button is shown, and future Jadwal rows read "Lihat"

#### Scenario: Earlier occurrence
- **WHEN** any role in scope opens an occurrence from last week
- **THEN** the attendance form is editable
