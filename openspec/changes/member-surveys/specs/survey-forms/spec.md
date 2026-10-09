# Spec Delta

## Purpose

Lets a group define custom survey forms whose questions apply to the group and all its descendants, and keeps those forms stable once members have answered them.

## ADDED Requirements

### Requirement: Survey ownership and inheritance
A survey SHALL belong to exactly one group X and SHALL apply to X and every descendant of X. A survey SHALL be visible to a user U in group G when X is an ancestor of G, G itself, or within U's scope; otherwise every survey page and action SHALL respond 404. Sub-groups SHALL NOT be able to opt out.

#### Scenario: Inherited survey visible below
- **WHEN** a USER in kelompok K opens a survey owned by K's desa
- **THEN** the survey is shown

#### Scenario: Survey in scope visible above
- **WHEN** an ADMIN of a daerah opens a survey owned by a kelompok under that daerah
- **THEN** the survey is shown read-only

#### Scenario: Other branch hidden
- **WHEN** a user opens a survey owned by a group that is neither an ancestor of nor in scope of their group
- **THEN** the system responds 404

#### Scenario: Deleted survey hidden
- **WHEN** a user opens a soft-deleted survey
- **THEN** the system responds 404

### Requirement: Only the owning group's admins edit a survey
Creating a survey SHALL require role ≥ ADMIN and SHALL set its group to the creator's own group. Updating the survey (title, description, questions, options) and soft-deleting it SHALL require role ≥ ADMIN and the user's group to equal the survey's group exactly. Users in ancestor groups, including a root OWNER, SHALL NOT edit or delete it.

#### Scenario: Owner admin edits
- **WHEN** an ADMIN of group X renames a question on a survey owned by X
- **THEN** the change is saved and audited

#### Scenario: USER cannot create
- **WHEN** a USER submits the create-survey action
- **THEN** the system responds 403 and nothing is written

#### Scenario: Ancestor admin cannot edit
- **WHEN** a root OWNER submits an update to a survey owned by a kelompok
- **THEN** the system responds 403 and nothing is written

#### Scenario: Descendant admin cannot edit
- **WHEN** an ADMIN of a kelompok submits an update to a survey owned by its desa
- **THEN** the system responds 403 and nothing is written

#### Scenario: Client cannot choose the owning group
- **WHEN** an ADMIN submits create-survey with a `groupId` different from their own group
- **THEN** the survey is created for the ADMIN's own group or the request is rejected; it is never owned by the submitted group

### Requirement: Survey fields
A survey SHALL have a title (required, trimmed, 1–200 chars), an optional description, and an ordered list of questions. A survey SHALL accept responses for as long as it is not soft-deleted; there is no draft, open or closed state.

#### Scenario: Empty title rejected
- **WHEN** a survey is saved with a blank title
- **THEN** validation fails with a field error and nothing is written

### Requirement: Question types
Each question SHALL have a type, a label (required), optional help text, a required flag and a position. Supported types: `SINGLE_CHOICE`, `MULTI_CHOICE`, `NUMBER`, `SCALE`, `SHORT_TEXT`, `LONG_TEXT`.
- Choice questions SHALL have at least two non-archived options with distinct non-empty labels.
- `SCALE` SHALL have integer `scaleMin < scaleMax`, defaulting to 1 and 5, with at most 11 steps.
- A "Ya/Tidak" preset SHALL create a `SINGLE_CHOICE` question with options "Ya" and "Tidak".
- A survey SHALL have at least one non-archived question before it can receive responses.

#### Scenario: Choice question needs two options
- **WHEN** a `SINGLE_CHOICE` question is saved with one option
- **THEN** validation fails

#### Scenario: Invalid scale rejected
- **WHEN** a `SCALE` question is saved with `scaleMin = 5`, `scaleMax = 1`
- **THEN** validation fails

#### Scenario: Yes/No preset
- **WHEN** an admin adds a question using the Ya/Tidak preset
- **THEN** a `SINGLE_CHOICE` question with options "Ya" and "Tidak" is created

### Requirement: Form locks once answered
While a survey has no responses, its questions and options MAY be freely added, edited, reordered and removed. Once a question has at least one answer:
- its type SHALL NOT change, and for `SCALE` its `scaleMin`/`scaleMax` SHALL NOT change;
- it SHALL NOT be removed, only archived (hidden from the entry form, kept in results);
- an option that has answers SHALL NOT be removed, only archived.
Labels, help text, required flag and order SHALL remain editable; new questions and options MAY always be added. An archived question or option MAY be restored.

#### Scenario: Type change rejected after answers
- **WHEN** the owner admin changes an answered question from `SINGLE_CHOICE` to `SHORT_TEXT`
- **THEN** the action is rejected and nothing is written

#### Scenario: Removing answered option archives it
- **WHEN** the owner admin removes an option that has answers
- **THEN** the option is archived, still counted in results, and no longer offered on the entry form

#### Scenario: Free edit before first answer
- **WHEN** a survey has no responses and the owner admin changes a question's type
- **THEN** the change is saved

#### Scenario: New question after answers
- **WHEN** the owner admin adds a question to a survey that already has responses
- **THEN** the question is saved and existing responses simply have no answer for it

### Requirement: Survey list
`/survei` SHALL list visible, non-deleted surveys (owned by an ancestor of, or a group within, the user's scope) with title, owning group, response count and an "inherited" badge for surveys owned above the user's group. It SHALL follow the standard list conventions: name search and multi-group filter (surveys that apply to a selected group), `PAGE_SIZE` pagination, state in the URL.

#### Scenario: Search by title
- **WHEN** the user searches "ramadhan"
- **THEN** only surveys whose title contains it (case-insensitive) are listed

### Requirement: Survey soft delete
Deleting a survey SHALL set `deletedAt`; its questions, responses and answers SHALL be kept but no longer shown or counted anywhere.

#### Scenario: Delete keeps data
- **WHEN** the owner admin deletes a survey with responses
- **THEN** the survey disappears from lists and its response rows still exist in the database
