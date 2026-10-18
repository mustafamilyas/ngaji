## Purpose

Bounds every value a Server Action accepts from the client — dates, free text, ids and lists — so malformed or oversized input is rejected before it reaches the database.

## ADDED Requirements

### Requirement: Dates are real calendar dates
Every date accepted by a Server Action or used from a URL parameter SHALL be a real calendar date in `YYYY-MM-DD` form with a year between 1900 and 2100. Values that only match the pattern (for example `2026-02-30` or `2026-99-99`) SHALL be rejected with a generic validation message, not silently normalized.

#### Scenario: Impossible date rejected
- **WHEN** a member is saved with `birthDate = "2026-02-30"`
- **THEN** the save is rejected with "Tanggal lahir tidak valid" and nothing is written

#### Scenario: Out-of-range year rejected
- **WHEN** an activity is saved with `startsOn = "0001-01-01"`
- **THEN** the save is rejected

#### Scenario: Valid leap day accepted
- **WHEN** an activity is saved with `startsOn = "2028-02-29"`
- **THEN** the save proceeds

### Requirement: Free text has maximum lengths
Every free-text field accepted by a Server Action SHALL have a maximum length: names 200 characters, locations 200, addresses 500, notes 1000, phone numbers 30, group and level names 100, usernames 50. Longer input SHALL be rejected, not truncated.

#### Scenario: Oversized activity notes
- **WHEN** an activity is saved with notes of 5,000 characters
- **THEN** the save is rejected and nothing is written

#### Scenario: Oversized occurrence location
- **WHEN** an occurrence override is saved with a 1,000-character location
- **THEN** the save is rejected

### Requirement: Ids and lists are bounded
Every id received from the client SHALL be validated as a positive integer before use, including ids passed as separate action arguments. Lists received from the client SHALL have an upper bound: attendance entries at most 1,000 per save, weekdays at most 7, group filters at most 50 ids.

#### Scenario: Non-numeric activity id
- **WHEN** the update-activity action is called with `activityId = "abc"`
- **THEN** it returns the generic validation error and no database query uses that value

#### Scenario: Oversized attendance payload
- **WHEN** an attendance save contains 5,000 entries
- **THEN** the save is rejected before any member is loaded
