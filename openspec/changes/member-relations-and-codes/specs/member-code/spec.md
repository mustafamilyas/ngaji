# Spec Delta

## Purpose

Gives every member a short, permanent, human-readable code that fits on a membership card and can later be encoded as a QR for venue check-in, and defines how it is assigned, shown and searched.

## ADDED Requirements

### Requirement: Organization code prefix
Every organization SHALL have a member code prefix of 2–4 uppercase letters `A–Z`, unique across all organizations. Input is trimmed and uppercased before validation (`anr` is stored as `ANR`). The prefix SHALL be set when the organization is created (`pnpm org:create`, `BOOTSTRAP_MEMBER_CODE_PREFIX`) and SHALL NOT be changeable afterwards through the app. Creating an organization with an invalid or already used prefix SHALL fail without creating anything.

#### Scenario: Valid prefix
- **WHEN** an organization is created with prefix `ANR`
- **THEN** the organization stores `ANR`

#### Scenario: Lowercase prefix
- **WHEN** an organization is created with prefix `anr`
- **THEN** the organization stores `ANR`

#### Scenario: Prefix already taken
- **WHEN** an organization is created with a prefix another organization uses
- **THEN** creation fails and no organization, group or user is created

#### Scenario: Invalid prefix
- **WHEN** an organization is created with prefix `A1` or `ABCDE`
- **THEN** creation fails with a validation error

### Requirement: Code format
A member code SHALL be `<PREFIX>-<6 characters>`, where the 6 characters are drawn uniformly at random from the Crockford base32 alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (no `I`, `L`, `O`, `U`), e.g. `ANR-7K3MQ9`. Codes SHALL NOT be sequential or derived from member data. A code SHALL be unique across all organizations.

#### Scenario: Shape
- **WHEN** a member is created in organization `ANR`
- **THEN** the member's code matches `^ANR-[0-9A-HJKMNP-TV-Z]{6}$`

#### Scenario: Collision
- **WHEN** the random code generated for a new member already exists
- **THEN** a new code is generated and the member is created with a unique code

### Requirement: Assignment and immutability
Every member SHALL receive a code when created, by form or CSV import. Codes SHALL be assigned on the server only: a code sent by the client (form field or CSV column) SHALL be ignored. A member's code SHALL never change: editing the member, changing status and soft delete keep it, and no action exposes regeneration. A soft-deleted member's code SHALL NOT be reused. Moving a member to another group keeps the code (in-place move, change `member-group-move`).

#### Scenario: Created by form
- **WHEN** a user creates a member
- **THEN** the member has a code and the `member.create` audit snapshot contains it

#### Scenario: CSV import
- **WHEN** a CSV with 40 importable rows is imported
- **THEN** each of the 40 members gets its own distinct code

#### Scenario: Client-supplied code ignored
- **WHEN** a create or update request includes a `code` value
- **THEN** the stored code is the server-generated one (create) or unchanged (update)

#### Scenario: Edit keeps code
- **WHEN** a member's name and group are edited
- **THEN** the code is unchanged

### Requirement: Backfill of existing data
After the migration, every existing organization SHALL be given a prefix and every existing member, including soft-deleted ones, SHALL be given a code by a one-off, idempotent command. Running the command again SHALL change nothing. Until an organization has a prefix, creating members in it SHALL fail with a generic error and be logged without PII.

#### Scenario: Backfill
- **WHEN** the backfill runs on a database with 2 organizations and 300 members without codes
- **THEN** both organizations have prefixes and all 300 members have unique codes

#### Scenario: Re-run
- **WHEN** the backfill runs a second time
- **THEN** no prefix or code changes

### Requirement: Display
The member code SHALL be shown on the member detail page header, selectable for copying, and SHALL be available as an optional member-list column `kode` ("Kode", hidden by default), which member views also offer. The code is not PII and MAY be shown to every user who can see the member.

#### Scenario: Detail page
- **WHEN** a user opens a member in scope
- **THEN** the member's code is shown

#### Scenario: Column hidden by default
- **WHEN** a user has not chosen columns
- **THEN** the member list does not show the code column

### Requirement: Search by code
The member list search on `/dashboard/anggota` SHALL also match the member code: the input is trimmed, uppercased, spaces and dashes removed, and `O`→`0`, `I`/`L`→`1` mapped. If the result looks like a full code (prefix + 6 characters), members with that exact code SHALL be included in addition to name matches. Results SHALL remain limited to the viewer's scope.

#### Scenario: Typed without dash, lowercase
- **WHEN** a user searches `anr7k3mq9`
- **THEN** member `ANR-7K3MQ9` is listed if in scope

#### Scenario: Ambiguous letters
- **WHEN** a user searches `ANR-7K3MQO` and the member's code is `ANR-7K3MQ0`
- **THEN** the member is listed

#### Scenario: Code of out-of-scope member
- **WHEN** a USER of K1 searches the code of a member of sibling kelompok K2
- **THEN** no result is shown
