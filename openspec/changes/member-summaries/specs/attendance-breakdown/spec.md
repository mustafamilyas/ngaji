# Spec Delta

## Purpose

Shows who attended activities broken down by member dimensions (sex, age, status, tags), and keeps attendance statistics fast for large groups by paginating every list on the server.

## ADDED Requirements

### Requirement: Breakdown by one dimension
Statistik → Kegiatan and the activity detail "Absensi" tab SHALL offer a "Rincian menurut" selector (`?rincian=`) with: none (default), sex, age bracket (`AGE_BRACKETS`), marital status, work status, and one visible tag key or simple tag. For the selected dimension, a table SHALL show per bucket: expected, hadir, izin, tidak hadir and % hadir, summed over the same occurrences the page already counts (not cancelled, effective date in range and ≤ today). Expected, hadir and izin SHALL use the same rules as the totals (DESIGN.md §6); a member is placed in a bucket by their current values (age on today's date, tags currently linked), and the bucket rows SHALL add up to the page's totals. An invalid or invisible `rincian` value SHALL be ignored (treated as none).

#### Scenario: By sex on an activity
- **WHEN** an activity had 2 occurrences in range, each with 10 expected (6 L, 4 P), and 9 L-attendances and 5 P-attendances were recorded as HADIR
- **THEN** the Laki-laki row shows expected 12, hadir 9 and the Perempuan row shows expected 8, hadir 5, and the rows add up to the totals

#### Scenario: By tag key
- **WHEN** the breakdown is key `prioritas` and some expected members have no value
- **THEN** a "Tanpa nilai" row holds them

#### Scenario: Invisible tag ignored
- **WHEN** `?rincian=` names a tag owned by a sibling branch
- **THEN** the page shows no breakdown and no error

#### Scenario: Cancelled occurrence excluded
- **WHEN** an occurrence in range is CANCELLED
- **THEN** it contributes to no bucket

### Requirement: Breakdown stays within the page's population
The breakdown SHALL count exactly the members the page already counts: on Statistik → Kegiatan, members in the selected scope group's subtree; on the activity "Absensi" tab, the members that tab already summarizes. It SHALL NOT reveal members or counts the page does not already show.

#### Scenario: Scope group narrows breakdown
- **WHEN** a desa user selects kelompok K on Statistik → Kegiatan with breakdown by sex
- **THEN** only members of K's subtree are counted

#### Scenario: Out-of-scope group rejected
- **WHEN** `?grup=` names a group outside the viewer's scope
- **THEN** the page responds 404

### Requirement: Attendance lists are paginated on the server
The participation table on Statistik → Partisipasi (`PAGE_SIZE`), and the per-occurrence and per-member tables on the activity "Absensi" tab (`EMBEDDED_PAGE_SIZE`, each with its own page parameter) SHALL send only the current page to the browser. Sorting SHALL be done on the server with `?sort=`/`?dir=` validated against each table's sortable columns (unknown values → default order, never passed to a query) with a stable tie-breaker (name, then id); changing sort or filters SHALL return to page 1, and a page past the end SHALL be clamped to the last page. Search by name on Statistik → Partisipasi SHALL be applied before pagination. A breakdown table SHALL also be paginated `EMBEDDED_PAGE_SIZE` when it has more rows than that.

#### Scenario: Only one page sent
- **WHEN** Statistik → Partisipasi has 300 rows
- **THEN** the page response contains `PAGE_SIZE` rows and a pager for 6 pages

#### Scenario: Sort across pages
- **WHEN** the user sorts participation by % hadir descending and opens page 2
- **THEN** page 2 continues the global order, not the order within page 1's rows

#### Scenario: Invalid sort ignored
- **WHEN** `?sort=phone` is requested
- **THEN** the default order is used

#### Scenario: Page clamped
- **WHEN** page 99 is requested for a table with 3 pages
- **THEN** page 3 is shown
