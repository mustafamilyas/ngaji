# Spec Delta

## MODIFIED Requirements

### Requirement: Definition shape
A view definition SHALL contain `version` (currently `1`), `filter`, `sort`, `groupBy` (optional), `summaries` (optional) and `columns`. `filter` SHALL be one level of nesting: a top-level conjunction (`AND` | `OR`) over 0–`VIEW_MAX_RULE_GROUPS` rule groups, each with its own conjunction over 1–`VIEW_MAX_RULES_PER_GROUP` rules. An empty filter SHALL match every member in scope. `summaries` SHALL hold 0–`VIEW_MAX_SUMMARIES` summary entries as defined by the `member-summaries` capability; a definition without `summaries` SHALL behave as one with an empty list. Definitions exceeding the limits or containing unknown keys SHALL be rejected on save, never truncated.

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

#### Scenario: Too many summaries rejected
- **WHEN** a save request contains `VIEW_MAX_SUMMARIES + 1` summaries
- **THEN** the save is rejected and nothing is written

#### Scenario: View saved before summaries existed
- **WHEN** a view saved without a `summaries` key is opened
- **THEN** it opens with no "Ringkasan" section and no notice

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
| tag | tag | has any of, has none of (1–`MAX_TAG_FILTER_IDS` tag IDs) |

A rule with an unknown field, an operator not allowed for the field, or a value of the wrong shape SHALL be rejected on save. The `tag` field SHALL NOT be sortable or usable in group-by.

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

#### Scenario: Has any of tags
- **WHEN** a rule is `tag has any of [fokus, prioritas:tinggi]`
- **THEN** members linked to at least one of those tags are returned

#### Scenario: Has none of tags
- **WHEN** a rule is `tag has none of [fokus]`
- **THEN** members not linked to `fokus` are returned, including members with no tags

#### Scenario: Sort by tag rejected
- **WHEN** a definition sorts by `tag`
- **THEN** it is rejected on save and the default sort is used for a draft

## ADDED Requirements

### Requirement: Tag rules only use tags the viewer can see
Tag IDs in a `tag` rule SHALL be resolved on the server against the tags visible to the viewer (owner group ∈ ancestors of the viewer's group ∪ the viewer's scope, not deleted, same organization). On save, an ID that is unknown, deleted, of another organization or not visible SHALL reject the save. On load (saved view or `?d=` draft), such IDs SHALL be removed from the rule; a rule left with no IDs SHALL be dropped, and the notice "Beberapa aturan diabaikan karena tidak berlaku lagi" shown. A `tag` rule SHALL NOT widen the result beyond the viewer's scope.

#### Scenario: Sibling branch tag rejected on save
- **WHEN** a user in kelompok K saves a rule using a tag owned by sibling kelompok S
- **THEN** the save is rejected and nothing is written

#### Scenario: Other organization tag rejected
- **WHEN** a save request contains a tag ID belonging to another organization
- **THEN** the save is rejected with the same generic error as an unknown ID

#### Scenario: Tag deleted after saving
- **WHEN** a saved view's only tag in a rule is soft-deleted
- **THEN** the view opens, that rule is ignored, and the notice is shown

#### Scenario: Inherited tag allowed
- **WHEN** a user in kelompok K saves a rule using a tag owned by its desa
- **THEN** the save succeeds and only members in K's scope with that tag are returned

#### Scenario: Descendant tag visible
- **WHEN** a user in desa D saves a rule using a tag owned by kelompok K under D
- **THEN** the save succeeds
