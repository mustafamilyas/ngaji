# landing-page Specification

## Purpose
Public marketing pages that explain Dahan to prospective organizations and let them contact the maintainer, without exposing any organization data.

## Requirements

### Requirement: Landing page at root for logged-out visitors
The system SHALL render the public landing page at `/` when the request has no valid session, and SHALL redirect `/` to `/dashboard` when it does. Every signed-in page SHALL live under `/dashboard`. A session that requires a password change SHALL still be redirected to `/dashboard/akun/password`.

#### Scenario: Anonymous visitor
- **WHEN** a visitor without a session requests `/`
- **THEN** the response is 200 with the landing page and no redirect to `/login`

#### Scenario: Logged-in user
- **WHEN** an active user with a valid session requests `/`
- **THEN** they are redirected to `/dashboard`, where the dashboard is rendered

#### Scenario: Password change pending
- **WHEN** a user with `mustChangePassword = true` requests `/`
- **THEN** they are redirected to `/dashboard/akun/password`, not shown the landing page

### Requirement: Public route allowlist
Only `/`, `/ormas`, `/login` and static assets SHALL be reachable without a session. Every other route SHALL keep redirecting unauthenticated requests to `/login`.

#### Scenario: Segment page is public
- **WHEN** a visitor without a session requests `/ormas`
- **THEN** the response is 200 with the ormas page

#### Scenario: App routes stay protected
- **WHEN** a visitor without a session requests `/dashboard/anggota`, `/dashboard/grup/1` or `/dashboard/kegiatan`
- **THEN** they are redirected to `/login` and no app data is rendered

#### Scenario: Logged-in user on segment page
- **WHEN** a logged-in user requests `/ormas`
- **THEN** the ormas page is rendered (it is marketing content, not app data)

### Requirement: Landing content
The landing page SHALL be in Bahasa Indonesia and present: the Dahan name and one-line positioning for hierarchical organizations; how it works (a group tree → a kegiatan set once at a higher level applies to all groups below → attendance taken from a phone → statistics roll up); data protection (audit log, no hard delete, each organization's data kept separate, UU PDP); a link to `/ormas`; a "Masuk" link to `/login`; and the contact CTA. It SHALL NOT show pricing. Illustrative UI (sample activity, group tree, attendance and recap cards) SHALL use fictional static sample data from `components/landing/content.ts`, never database content.

#### Scenario: Key sections present
- **WHEN** the landing page is rendered
- **THEN** it contains the positioning, how-it-works, data-protection sections, a link to `/ormas` and a link to `/login`

#### Scenario: Ormas page wording
- **WHEN** `/ormas` is rendered
- **THEN** it uses ormas terms (anggota, pengurus, pusat/wilayah/daerah/cabang) and has the same contact CTA

### Requirement: WhatsApp contact CTA from configuration
The contact CTA SHALL link to `https://wa.me/<number>` (new tab, `rel="noopener noreferrer"`) using a number from deployment configuration, normalized with the same rules as member WhatsApp links (DESIGN.md §7.1). If the number is missing or invalid, the CTA SHALL NOT be rendered and the page SHALL still render.

#### Scenario: Number configured
- **WHEN** the configured number is `0812-3456-7890`
- **THEN** the CTA links to `https://wa.me/6281234567890`

#### Scenario: Number missing
- **WHEN** no number is configured
- **THEN** no WhatsApp CTA is rendered and the page returns 200

#### Scenario: Number invalid
- **WHEN** the configured number is `abc`
- **THEN** no WhatsApp CTA is rendered

### Requirement: Public pages expose no organization data
Public pages SHALL NOT query the database or render any organization, group, member, user or attendance data, including the organization's name. They SHALL load no third-party scripts, fonts beyond those already self-hosted, trackers or analytics, and SHALL be served under the existing CSP.

#### Scenario: No data on landing
- **WHEN** a visitor without a session requests `/` on a deployment with members
- **THEN** the HTML contains no organization name, group name, member name or count from the database

#### Scenario: No external requests
- **WHEN** the landing page loads in a browser
- **THEN** every network request goes to the deployment's own origin

### Requirement: Mobile-first public pages
Public pages SHALL be usable at 360px width without horizontal scrolling, with the CTA reachable without zooming.

#### Scenario: Phone width
- **WHEN** the landing page is viewed at 360px width
- **THEN** there is no horizontal scroll and the CTA and "Masuk" link are visible and tappable
