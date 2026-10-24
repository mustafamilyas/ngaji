# Spec Delta

## MODIFIED Requirements

### Requirement: Public route allowlist
Only `/`, `/ormas`, `/daftar`, `/login` and static assets SHALL be reachable without a session. Every other route SHALL keep redirecting unauthenticated requests to `/login`.

#### Scenario: Segment page is public
- **WHEN** a visitor without a session requests `/ormas`
- **THEN** the response is 200 with the ormas page

#### Scenario: Interest page is public
- **WHEN** a visitor without a session requests `/daftar`
- **THEN** the response is 200 with the interest form

#### Scenario: App routes stay protected
- **WHEN** a visitor without a session requests `/dashboard/anggota`, `/dashboard/grup/1` or `/dashboard/kegiatan`
- **THEN** they are redirected to `/login` and no app data is rendered

#### Scenario: Logged-in user on segment page
- **WHEN** a logged-in user requests `/ormas`
- **THEN** the ormas page is rendered (it is marketing content, not app data)

### Requirement: WhatsApp contact CTA from configuration
The contact CTA on `/` and `/ormas` SHALL read "Daftar minat" (or equivalent wording) and link to `/daftar`, where the interest form hands off to WhatsApp using `DAHAN_WHATSAPP` (capability `interest-signup`). The CTA SHALL be rendered whether or not `DAHAN_WHATSAPP` is configured.

#### Scenario: CTA links to the form
- **WHEN** the landing page is rendered
- **THEN** the contact CTA links to `/daftar`, not directly to `wa.me`

#### Scenario: Number configured
- **WHEN** `DAHAN_WHATSAPP` is `0812-3456-7890` and a visitor follows the CTA and submits the form
- **THEN** the WhatsApp handoff goes to `https://wa.me/6281234567890`

#### Scenario: Number missing
- **WHEN** `DAHAN_WHATSAPP` is not configured
- **THEN** the CTA is still rendered, links to `/daftar`, and the page returns 200

#### Scenario: Number invalid
- **WHEN** `DAHAN_WHATSAPP` is `abc`
- **THEN** the CTA still links to `/daftar`, and the form's success state shows no WhatsApp link

### Requirement: Public pages expose no organization data
Public pages SHALL NOT read from the database or render any organization, group, member, user, attendance or lead data, including any organization's name. The only exceptions SHALL be: `/login` reading the organization count and name as allowed by the generic login page requirement, and `/daftar` writing a lead (and reading recent lead counts for its rate limit) on submit. They SHALL load no third-party scripts, fonts beyond those already self-hosted, trackers or analytics, and SHALL be served under the existing CSP.

#### Scenario: No data on landing
- **WHEN** a visitor without a session requests `/` on a deployment with members
- **THEN** the HTML contains no organization name, group name, member name or count from the database

#### Scenario: No leads on the form page
- **WHEN** a visitor opens `/daftar` after other leads were submitted
- **THEN** the HTML contains no data from any earlier lead

#### Scenario: No external requests
- **WHEN** the landing page or `/daftar` loads in a browser
- **THEN** every network request goes to the deployment's own origin
