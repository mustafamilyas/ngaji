# Spec Delta

## Purpose

Lets users record, correct and remove one member's answers to a survey, entered one by one by an admin or user on the member's behalf.

## ADDED Requirements

### Requirement: Who may record a response
A user U in group G MAY save or delete a response to survey S (owned by X) for member M only when all of:
1. X is an ancestor of G or G itself (the user is in X or below);
2. M's group is a leaf group within U's scope (which, given 1, is always within X's subtree);
3. M is not soft-deleted, and — for saving only — has `status = AKTIF` (an existing response of a member who has since left can still be deleted);
4. S is not soft-deleted.
Users above X SHALL only view. Every `surveyId` and `memberId` from the client SHALL be resolved server-side; a survey or member outside visibility/scope SHALL respond 404.

#### Scenario: Kelompok user records for own member
- **WHEN** a USER of kelompok K saves a response for a member of K on a survey owned by K's desa
- **THEN** the response is saved and audited

#### Scenario: Ancestor user cannot record
- **WHEN** an ADMIN of the daerah saves a response on a survey owned by a desa under it
- **THEN** the system responds 403 and nothing is written

#### Scenario: Member outside scope
- **WHEN** a user submits a `memberId` from a leaf group outside their scope
- **THEN** the system responds 404 and nothing is written

#### Scenario: Inactive member rejected
- **WHEN** a response is submitted for a member with `status = KELUAR`
- **THEN** the action is rejected and nothing is written

### Requirement: One response per member per survey
A member SHALL have at most one response per survey. Saving for a member who already has a response SHALL replace all of that response's answers and record who last saved it and when.

#### Scenario: Re-save overwrites
- **WHEN** a response exists for member M and a user saves new answers for M
- **THEN** there is still exactly one response for (S, M), holding only the new answers, and the audit entry has the previous answers as `before`

### Requirement: Answers are validated against the form
On save the server SHALL validate every answer against the survey's current, non-archived questions:
- `questionId`/`optionId` that do not belong to the survey, or that are archived, SHALL be rejected;
- `SINGLE_CHOICE`: exactly one option; `MULTI_CHOICE`: one or more distinct options;
- `NUMBER`: a finite number; `SCALE`: an integer within `[scaleMin, scaleMax]`;
- `SHORT_TEXT`: trimmed, ≤ 200 chars; `LONG_TEXT`: trimmed, ≤ 2000 chars;
- a required question without an answer SHALL be rejected; an optional question MAY be left empty (no answer stored).
Validation errors SHALL be reported per question; nothing is written when any answer is invalid.

#### Scenario: Option from another survey
- **WHEN** a submitted `optionId` belongs to a different survey
- **THEN** the save is rejected and nothing is written

#### Scenario: Scale out of range
- **WHEN** a 1–5 scale question receives 7
- **THEN** the save is rejected with an error on that question

#### Scenario: Missing required answer
- **WHEN** a required question is left empty
- **THEN** the save is rejected with an error on that question

#### Scenario: Optional left empty
- **WHEN** an optional question is left empty
- **THEN** the response is saved without an answer for that question

### Requirement: Archived questions on existing responses
When an existing response is re-saved, answers to questions or options archived since the original save SHALL be kept unchanged; the entry form SHALL show them read-only.

#### Scenario: Answer to archived question survives edit
- **WHEN** a response answered question Q, Q is then archived, and the response is re-saved
- **THEN** the stored answer to Q is unchanged

### Requirement: Delete a response
A user allowed to record a response for M SHALL be able to delete it. Deleting SHALL remove the response and its answers permanently (like attendance rows) and SHALL write an audit entry holding the deleted answers as `before`.

#### Scenario: Delete audited
- **WHEN** a user deletes member M's response
- **THEN** M has no response for the survey and a `survey_response.delete` entry with the previous answers exists

#### Scenario: Ancestor cannot delete
- **WHEN** a user above the survey's group submits a delete
- **THEN** the system responds 403 and the response remains

### Requirement: Entry page
`/survei/[id]/isi` SHALL let an allowed user pick a member (autocomplete by name over members they may record for) and fill in or edit that member's answers on one mobile-friendly page. With `?anggota=<id>` the member is preselected and existing answers are prefilled. After saving, the user SHALL be able to move on to the next member without leaving the page. Users who may only view SHALL NOT see the entry page (404 or redirect to the survey).

#### Scenario: Prefilled edit
- **WHEN** the user opens `/survei/5/isi?anggota=12` and member 12 already responded
- **THEN** the form shows member 12's current answers

### Requirement: Respondent list
The "Responden" tab on `/survei/[id]` SHALL list responses visible to the user (members in their scope) with member name, group, last saved by and when, an edit link and a delete action where allowed; searchable by name, filterable by group, paginated with `PAGE_SIZE`.

#### Scenario: Scope-filtered respondents
- **WHEN** a kelompok user views the respondents of a desa-wide survey
- **THEN** only responses of members in their kelompok are listed
