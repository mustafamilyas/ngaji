# Spec Delta

## Purpose

Defines what a member view definition can express (rules, sort, grouping, columns) and how it turns into a scope-limited, PII-safe member list.

## ADDED Requirements

### Requirement: Definition shape
A view definition SHALL contain `version` (currently `1`), `filter`, `sort`, `groupBy` (optional) and `columns`. `filter` SHALL be one level of nesting: a top-level conjunction (`AND` | `OR`) over 0–`VIEW_MAX_RULE_GROUPS` rule groups, each with its own conjunction over 1–`VIEW_MAX_RULES_PER_GROUP` rules. An empty filter SHALL match every member in scope. Definitions exceeding the limits or containing unknown keys SHALL be rejected on save, never truncated.

#### Scenario: AND of OR groups
- **WHEN** the filter is `(sex = L OR sex = P) AND (age ≥ 13 AND age ≤ 17)`
- **THEN** only members aged 13–17 are returned

#### Scenario: OR of AND groups
- **WHEN** the filter is `(age ≤ 12 AND sex = P) OR (status = PINDAH)`
- **THEN** members matching either group are returned

#### Scenario: Nested group rejected
- **WHEN** a save request contains a rule group inside a rule group
- **THEN** it is rejected with a validation error

#### Scenario: Too many rules rejected
- **WHEN** a rule group contains `VIEW_MAX_RULES_PER_GROUP + 1` rules
- **THEN** the save is rejected and nothing is written

### Requirement: Fields and operators
Rules SHALL only reference these fields, with these operators:

| Field | Type | Operators |
|---|---|---|
| name, birthPlace | text | contains (case-insensitive for ASCII), equals (exact match, case-sensitive on SQLite); values trimmed |
| sex, status, maritalStatus, workStatus | choice | is any of, is none of (values must be valid enum values) |
| birthDate, joinedAt | date | before, on or before, after, on or after, between (inclusive), within the last N days |
| exitedAt | date (nullable) | the date operators, plus is empty / is not empty |
| age | number (whole years) | =, ≠, >, ≥, <, ≤, between (inclusive) |
| group | org group | is in subtree of any of (group IDs) |

A rule with an unknown field, an operator not allowed for the field, or a value of the wrong shape SHALL be rejected on save.

#### Scenario: Operator not allowed for field
- **WHEN** a rule is `sex > L`
- **THEN** the save is rejected with a validation error

#### Scenario: Invalid enum value
- **WHEN** a rule is `status is any of [HILANG]`
- **THEN** the save is rejected

#### Scenario: Exited is empty
- **WHEN** a rule is `exitedAt is empty`
- **THEN** only members with no exit date are returned

#### Scenario: Within the last N days
- **WHEN** today (Asia/Jakarta) is 2026-10-12 and the rule is `joinedAt within the last 30 days`
- **THEN** members with `joinedAt` from 2026-09-12 through 2026-10-12 are returned, and the result changes as days pass

### Requirement: Age is computed from birth date on the day of viewing
`age` SHALL be the member's age in whole completed years on today's date in Asia/Jakarta, computed the same way as elsewhere in the app, and SHALL be evaluated at query time (never stored).

#### Scenario: Birthday today counts
- **WHEN** today is 2026-10-12, a member was born 2009-10-12 and the rule is `age ≥ 17`
- **THEN** the member is included

#### Scenario: Day before birthday
- **WHEN** today is 2026-10-11, a member was born 2009-10-12 and the rule is `age ≥ 17`
- **THEN** the member is excluded

#### Scenario: Between is inclusive
- **WHEN** the rule is `age between 13 and 17`
- **THEN** members aged exactly 13 and exactly 17 are included and a member aged 18 is excluded

### Requirement: PII fields are never queryable
`phone`, `address` and `email` SHALL NOT be usable in rules, sort or group-by. They MAY be shown only as columns, following the `/anggota` column rules.

#### Scenario: Filter on phone rejected
- **WHEN** a save request or URL draft contains a rule on `phone`
- **THEN** it is rejected (save) or ignored with a notice (draft)

#### Scenario: Sort on address rejected
- **WHEN** a definition sorts by `address`
- **THEN** it is rejected and the default sort is used for a draft

### Requirement: Results are scope-limited
The result set SHALL always be limited to non-deleted members in the viewer's scope, whatever the definition says. Group IDs in a definition SHALL be resolved on the server: on save, a group ID that does not exist, is deleted or is out of the viewer's scope SHALL reject the save; on load, such a rule SHALL be dropped and a notice "Beberapa aturan diabaikan karena tidak berlaku lagi" shown, instead of failing the page.

#### Scenario: Out-of-scope group on save
- **WHEN** a user in kelompok K saves a rule `group in subtree of [sibling kelompok]`
- **THEN** the save is rejected and nothing is written

#### Scenario: Group deleted after saving
- **WHEN** a saved view references a group that was later soft-deleted
- **THEN** the view opens, that rule is ignored, and the notice is shown

#### Scenario: Empty filter still scoped
- **WHEN** a view has no rules
- **THEN** only members in the viewer's scope are listed

#### Scenario: Soft-deleted members excluded
- **WHEN** a member matching all rules is soft-deleted
- **THEN** the member is not listed or counted

### Requirement: Sort
A definition SHALL have exactly one sort key — name, birthDate, age, joinedAt, exitedAt, birthPlace, sex, status, maritalStatus, workStatus or group (name) — and a direction (`asc` | `desc`), always followed by a stable tie-breaker (name, then id). Sorting by age SHALL order by birth date in the opposite direction. The default sort SHALL be name ascending.

#### Scenario: Age descending
- **WHEN** the sort is age descending
- **THEN** the oldest member is first

#### Scenario: Stable ties
- **WHEN** two members have the same birth date and the sort is birthDate
- **THEN** they are ordered by name, then id, identically on every load

### Requirement: Group by
A definition MAY group results by one of: a choice property (sex, status, maritalStatus, workStatus); org group at a chosen level depth (from the view's group depth to the leaf depth, sections named after the ancestor group at that level); or age buckets. Age buckets SHALL be 1–`VIEW_MAX_AGE_BUCKETS` entries, each with a label (1–50 chars), a whole-year `min` and an optional `max` (inclusive), non-overlapping; a new age grouping SHALL start from `AGE_BRACKETS`. Members matching no bucket SHALL go to a final "Lainnya" section. Sections SHALL be ordered by enum order, bucket order, or group name; empty sections SHALL NOT be shown. Within a section the view's sort applies.

#### Scenario: Group by age buckets
- **WHEN** the buckets are "Remaja 13–17" and "Pemuda 18–30" and a member is 40
- **THEN** sections "Remaja", "Pemuda" and "Lainnya" are shown, the 40-year-old in "Lainnya"

#### Scenario: Overlapping buckets rejected
- **WHEN** buckets 13–17 and 17–25 are saved
- **THEN** the save is rejected with a validation error

#### Scenario: Group by org level
- **WHEN** a user in daerah X groups by the desa level
- **THEN** each section is a desa under X, containing members of all kelompok beneath it

#### Scenario: Level above view group rejected
- **WHEN** a user in desa D groups by the daerah level
- **THEN** the save is rejected

#### Scenario: Empty section hidden
- **WHEN** no matching member is `KELUAR` and the view groups by status
- **THEN** no "Keluar" section is shown

### Requirement: Grouped and ungrouped result display
Without grouping, results SHALL be a table paginated `PAGE_SIZE` per page (`?page=`) with the total count. With grouping, each section SHALL show its label and member count, be collapsible (the first `VIEW_EXPANDED_SECTIONS` sections start expanded, the rest collapsed), show the first `VIEW_SECTION_PAGE_SIZE` members when expanded and offer "Tampilkan lebih banyak" to load the next `VIEW_SECTION_PAGE_SIZE` of that section only. Collapsed state is per viewer and not saved in the view.

#### Scenario: Section counts
- **WHEN** a grouped view has 120 matching members in section "Remaja"
- **THEN** the header shows 120 and the section initially lists `VIEW_SECTION_PAGE_SIZE` members

#### Scenario: Load more in one section
- **WHEN** the user clicks "Tampilkan lebih banyak" in "Remaja"
- **THEN** the next members of "Remaja" are appended and other sections are unchanged

### Requirement: Columns
A definition SHALL store its optional columns using the same keys, order and defaults as the `/anggota` table. Only chosen columns SHALL be rendered on the server; unknown keys SHALL be dropped. The name column is always shown.

#### Scenario: Hidden column not sent
- **WHEN** a view does not include the phone column
- **THEN** no phone number appears in the page response
