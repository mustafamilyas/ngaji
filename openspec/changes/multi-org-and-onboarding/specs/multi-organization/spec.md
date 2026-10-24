# Spec Delta

## Purpose

Lets one running app and one database host several organizations, each fully isolated from the others, while staying usable as a single-organization deployment.

## ADDED Requirements

### Requirement: Organization resolved from the signed-in user
A user's organization SHALL be the organization of the group in their `UserGroupRole`. Every org-wide value shown or used for a signed-in user (organization name, timezone, levels, max depth) SHALL be resolved from that organization on the server. The system SHALL NOT pick "the first" or "the only" organization for a signed-in user, and SHALL NOT accept an organization id from the client.

#### Scenario: Two organizations, two names
- **WHEN** org A "Pengajian Al-Ikhlas" and org B "Majelis An-Nur" exist, and a user of org B signs in
- **THEN** the sidebar, document titles and print header show "Majelis An-Nur", never "Pengajian Al-Ikhlas"

#### Scenario: Levels per organization
- **WHEN** org A has 4 levels and org B has 3 levels
- **THEN** a user of org B sees org B's 3 level names, and only org B's depth-2 groups count as leaf groups

#### Scenario: Client-supplied organization id is ignored
- **WHEN** a request from a user of org A carries an `organizationId` of org B in form data or the URL
- **THEN** the value is ignored and every result belongs to org A

### Requirement: Data isolation between organizations
No user SHALL be able to read or change any group, member, activity, occurrence, attendance, survey, member view, user, level or audit entry of another organization. An entity id from another organization SHALL be treated as out of scope and answered with 404, the same as an out-of-scope entity in the user's own organization. Root OWNERs SHALL have no cross-organization access.

#### Scenario: Member id from another organization
- **WHEN** an OWNER at the root of org A opens `/dashboard/anggota/<id>` for a member of org B
- **THEN** the response is 404 and no member data is rendered

#### Scenario: Mutation against another organization
- **WHEN** an ADMIN of org A submits a server action with an `activityId` of org B
- **THEN** the action fails as not found, nothing is written, and no audit entry for org B's activity is created

#### Scenario: Lists stay within the organization
- **WHEN** a root OWNER of org A lists members, users, activities or audit entries with no filter
- **THEN** no row belonging to org B appears

#### Scenario: Last-owner protection is per organization
- **WHEN** org A has one active OWNER at its root and org B has three
- **THEN** org A's OWNER still cannot deactivate or demote themself, regardless of org B's owners

### Requirement: Globally unique usernames
Usernames SHALL be unique across all organizations. Login SHALL ask only for username and password; the organization SHALL follow from the user.

#### Scenario: Duplicate username in another organization
- **WHEN** an OWNER of org B creates a user with a username that already exists in org A
- **THEN** creation is rejected with the same generic "username sudah dipakai" message used within one organization, and no user is created

#### Scenario: Login lands in the right organization
- **WHEN** a user of org B signs in with username and password
- **THEN** they land on org B's dashboard with org B's scope

### Requirement: Generic login page
`/login` SHALL show the Dahan brand and SHALL NOT show any organization name in the page or its document title (`Masuk · Dahan`), unless the deployment flag `LOGIN_SHOW_ORG_NAME` is `true` **and** exactly one organization exists. In that case the page SHALL show that organization's name with "oleh Dahan", and the title SHALL be `Masuk · <organization name>`. Any other flag value SHALL be treated as off.

#### Scenario: Flag off
- **WHEN** `LOGIN_SHOW_ORG_NAME` is unset and one organization exists
- **THEN** `/login` shows "Dahan", its title is `Masuk · Dahan`, and the HTML contains no organization name

#### Scenario: Flag on, single organization
- **WHEN** `LOGIN_SHOW_ORG_NAME=true` and exactly one organization "Pengajian Al-Ikhlas" exists
- **THEN** `/login` shows "Pengajian Al-Ikhlas" with "oleh Dahan", and the title is `Masuk · Pengajian Al-Ikhlas`

#### Scenario: Flag on, several organizations
- **WHEN** `LOGIN_SHOW_ORG_NAME=true` and two organizations exist
- **THEN** `/login` shows the generic Dahan page and no organization name

#### Scenario: Flag on, empty database
- **WHEN** `LOGIN_SHOW_ORG_NAME=true` and no organization exists
- **THEN** `/login` renders the generic Dahan page without error
