# Spec Delta

## Purpose

Lets a user add many members to one leaf group from a CSV file, with the same scope, validation, and audit guarantees as adding one member.

## ADDED Requirements

### Requirement: Import is limited to a leaf group in scope
Without a `grup` column, an import SHALL target exactly one group, chosen on the page, and every row SHALL go to that group. The group id SHALL be resolved on the server for both preview and confirm. A group outside the user's scope or organization SHALL respond as not found, and a non-leaf group SHALL be rejected. Any role allowed to create a member in that group SHALL be allowed to import into it. The chooser SHALL offer only leaf groups in the user's scope.

#### Scenario: USER imports into own leaf group
- **WHEN** a user with role USER confirms a valid file for a leaf group in scope
- **THEN** the members are created in that group

#### Scenario: Group outside scope
- **WHEN** a request names a group outside the user's scope
- **THEN** the system responds not found and creates nothing

#### Scenario: Group in another organization
- **WHEN** a request names a group of another organization
- **THEN** the system responds not found and creates nothing

#### Scenario: Non-leaf group
- **WHEN** a request names a group that is not at the deepest level
- **THEN** the import is rejected and nothing is created

#### Scenario: Not signed in
- **WHEN** an unauthenticated request calls preview or confirm
- **THEN** the request is rejected and nothing is read or created

### Requirement: Rows may name their own leaf group
A file MAY have a `grup` column. When it does, the column SHALL replace the group chosen on the page, and every row SHALL go to the group it names. A cell SHALL hold a leaf group's name, matched after trimming, collapsing spaces, and ignoring case, against non-deleted leaf groups in the user's scope. A blank cell, a name matching no such group, and a name matching more than one SHALL each be a row error. A name outside the user's scope or organization SHALL report the same error as an unknown name. A non-leaf group's name SHALL report the same error. Without a `grup` column, the chosen group SHALL be required.

#### Scenario: Higher-level user loads several groups
- **WHEN** a user at desa level confirms a file whose rows name two kelompok in scope
- **THEN** each member is created in the group its row names

#### Scenario: Blank group cell
- **WHEN** the file has a `grup` column and a row leaves it empty
- **THEN** that row reports the missing group

#### Scenario: Name matches two groups
- **WHEN** `grup` is `Kelompok 1` and two leaf groups in scope have that name
- **THEN** that row reports an ambiguous group

#### Scenario: Group outside scope by name
- **WHEN** `grup` names a leaf group outside the user's scope
- **THEN** that row reports the same error as an unknown group

#### Scenario: Non-leaf group by name
- **WHEN** `grup` names a group that is not at the deepest level
- **THEN** that row reports the same error as an unknown group

#### Scenario: No column and no chosen group
- **WHEN** a file has no `grup` column and no group is chosen
- **THEN** the import is rejected and nothing is created

### Requirement: Template and columns
The page SHALL offer a CSV template containing only the header row, with no example member, and SHALL list each column and its accepted values. The columns SHALL be `nama`, `tempat_lahir`, `tanggal_lahir`, `jenis_kelamin`, `alamat`, `status_nikah`, `pekerjaan` (required), and `no_hp`, `email`, `status`, `tanggal_masuk`, `tanggal_keluar`, `grup` (optional). Header matching SHALL ignore case and treat spaces and underscores alike. Unknown columns SHALL be ignored and named in the preview. A missing required column SHALL fail the file, and so SHALL a column that appears more than once.

#### Scenario: Header variants
- **WHEN** the header reads `Tanggal Lahir`
- **THEN** it is read as `tanggal_lahir`

#### Scenario: Missing required column
- **WHEN** the file has no `alamat` column
- **THEN** the preview reports the missing column and the import cannot be confirmed

#### Scenario: Repeated column
- **WHEN** the file has both `Tanggal Lahir` and `tanggal_lahir`
- **THEN** the preview names the repeated column and the import cannot be confirmed

#### Scenario: Unknown column
- **WHEN** the file has a `catatan` column
- **THEN** the preview names it as ignored and its values are not stored

### Requirement: File limits and formats
The system SHALL accept only `.csv` files within the configured size and row limits, and SHALL reject others with a clear message. It SHALL accept `,` or `;` separators, a leading BOM, and UTF-8 or Windows-1252 text. Rows with every cell empty SHALL be skipped. A file with broken quotes SHALL be rejected, with a message that repeats no cell values.

#### Scenario: Excel file uploaded
- **WHEN** a user uploads `anggota.xlsx`
- **THEN** the system asks them to save it as CSV and creates nothing

#### Scenario: Too many rows
- **WHEN** a file has more rows than `MAX_IMPORT_ROWS`
- **THEN** the file is rejected with the limit stated

#### Scenario: Semicolon file with BOM
- **WHEN** a file exported by Excel uses `;` and starts with a BOM
- **THEN** its columns and first header are read correctly

#### Scenario: Windows-1252 text
- **WHEN** a file is not valid UTF-8 and contains `é` in Windows-1252
- **THEN** the name is stored with `é`

#### Scenario: Trailing empty rows
- **WHEN** a file ends with rows of empty cells
- **THEN** those rows are not counted or reported

#### Scenario: Broken quote
- **WHEN** a cell opens a quote that never closes
- **THEN** the file is rejected and the import cannot be confirmed

#### Scenario: Header only
- **WHEN** a file has no data rows
- **THEN** the preview says the file has no data and the import cannot be confirmed

### Requirement: Rows follow the single-member rules
Each row SHALL be validated by the same rules as the member form, after the conversions below.
- Dates SHALL be accepted as `YYYY-MM-DD` or day-first `D/M/YYYY` and `D-M-YYYY`; other forms SHALL be rejected, including two-digit years and spreadsheet serial numbers.
- Enum columns SHALL accept the stored value or its Indonesian label, ignoring case.
- `status` SHALL default to `AKTIF`, and `tanggal_masuk` SHALL default to today in the organization's time zone.
- `tanggal_keluar` SHALL be required when `status` is not `AKTIF`.
- `no_hp` in scientific notation SHALL be rejected.

#### Scenario: Day-first date
- **WHEN** `tanggal_lahir` is `05/03/1990`
- **THEN** it is stored as `1990-03-05`

#### Scenario: Impossible date
- **WHEN** `tanggal_lahir` is `31/02/1990`
- **THEN** that row reports an invalid date

#### Scenario: Two-digit year
- **WHEN** `tanggal_lahir` is `05/03/90`
- **THEN** that row reports an invalid date

#### Scenario: Label for an enum
- **WHEN** `jenis_kelamin` is `perempuan` and `status_nikah` is `Belum Menikah`
- **THEN** they are stored as `P` and `BELUM_MENIKAH`

#### Scenario: Defaults
- **WHEN** `status` and `tanggal_masuk` are empty
- **THEN** the member is `AKTIF` and joined today in the organization's time zone

#### Scenario: Exit date required
- **WHEN** `status` is `KELUAR` and `tanggal_keluar` is empty
- **THEN** that row reports the missing exit date

#### Scenario: Phone damaged by Excel
- **WHEN** `no_hp` is `6.28E+11`
- **THEN** that row reports an invalid phone number

### Requirement: Preview before anything is stored
Uploading a file SHALL produce a preview and SHALL NOT create members or store the file. The preview SHALL show the number of valid rows, invalid rows, and duplicates, and SHALL list errors with their spreadsheet row number and column, without repeating cell values. At most `MAX_IMPORT_ERRORS_SHOWN` errors SHALL be listed, with the total stated.

#### Scenario: Preview creates nothing
- **WHEN** a user uploads a valid file and leaves the page
- **THEN** no member or audit entry exists for it

#### Scenario: Row number
- **WHEN** the third data row has an invalid date
- **THEN** the error names spreadsheet row 4 and column `tanggal_lahir`

#### Scenario: Many errors
- **WHEN** a file has more errors than the display limit
- **THEN** the preview lists up to the limit and states the total

### Requirement: Import is all-or-nothing
Confirm SHALL re-read and re-validate the file on the server, without trusting the preview. If any row is invalid, nothing SHALL be created and the preview SHALL be shown again. Otherwise all members and their audit entries SHALL be written in one transaction. The result SHALL state how many members were created and how many duplicates were skipped, with a link to that group's list, or to the Anggota list when the file used `grup`.

#### Scenario: One invalid row
- **WHEN** confirm receives 100 rows and one is invalid
- **THEN** no members are created and the error is shown

#### Scenario: Failure during write
- **WHEN** a write fails partway through the transaction
- **THEN** no member and no audit entry from that import remains

#### Scenario: Group changes after preview
- **WHEN** the group stops being a valid target between preview and confirm
- **THEN** confirm is rejected and nothing is created

### Requirement: Likely duplicates are skipped by default
A row SHALL be a duplicate when its normalized name and birth date match a non-deleted member within the user's scope, or an earlier row of the same file. Normalization SHALL trim, collapse spaces, and ignore case. Phone SHALL NOT be used. Matching SHALL NOT consider members outside the user's scope. Duplicates SHALL be skipped unless the user ticks "Tetap impor", which applies to all of them. If no rows remain to create, confirm SHALL be unavailable.

#### Scenario: Same file uploaded twice
- **WHEN** a file already imported is uploaded again
- **THEN** every row is marked as a duplicate and nothing can be confirmed until "Tetap impor" is ticked

#### Scenario: Family sharing a phone
- **WHEN** two rows share `no_hp` but differ in name
- **THEN** neither is a duplicate

#### Scenario: Member outside scope
- **WHEN** a row matches a member the user cannot see
- **THEN** the row is not marked as a duplicate

#### Scenario: Soft-deleted member
- **WHEN** a row matches only a soft-deleted member
- **THEN** the row is not marked as a duplicate

#### Scenario: Force import
- **WHEN** "Tetap impor" is ticked and the user confirms
- **THEN** the duplicates are created along with the other rows

### Requirement: Every imported member is audited
Each created member SHALL have a `member.create` audit entry with the full snapshot and the importing user as actor, written in the same transaction. All entries of one import SHALL share `meta.importId`. Application logs SHALL NOT contain file contents or member data.

#### Scenario: Audit entries
- **WHEN** an import creates 50 members
- **THEN** 50 `member.create` entries exist with the same `meta.importId`

#### Scenario: Failed parse logging
- **WHEN** a file fails to parse
- **THEN** the application log contains no cell values
