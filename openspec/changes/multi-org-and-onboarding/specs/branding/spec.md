# Spec Delta

## MODIFIED Requirements

### Requirement: Organization name first inside the app
In the app shell sidebar (desktop and mobile drawer), the system SHALL show the signed-in user's organization name (`Organization.name` of the organization their group belongs to) as the primary label and a secondary "oleh Dahan" mark. The organization name SHALL come from the server, never from client input. The login page SHALL show an organization name only as defined by the generic login page requirement (capability `multi-organization`).

#### Scenario: Sidebar label
- **WHEN** a logged-in user of the organization "Pengajian Al-Ikhlas" views any app page
- **THEN** the sidebar shows "Pengajian Al-Ikhlas" with "oleh Dahan" beneath it

#### Scenario: Collapsed sidebar
- **WHEN** the desktop sidebar is collapsed to icons
- **THEN** only the logo mark is shown and its accessible name contains the user's organization name

#### Scenario: Login page
- **WHEN** a visitor opens `/login` and `LOGIN_SHOW_ORG_NAME` is not `true`
- **THEN** the page shows "Dahan" and no organization name above the form

### Requirement: Document title
Logged-in pages SHALL have the document title `<page> · <organization name>` where a page name exists, otherwise `<organization name> · Dahan`, using the signed-in user's organization. `/login` SHALL use `Masuk · Dahan`, or `Masuk · <organization name>` only when the generic login page requirement allows the name. Other public pages SHALL use a title with "Dahan" and no organization name.

#### Scenario: App page title
- **WHEN** a logged-in user of "Pengajian Al-Ikhlas" opens the dashboard
- **THEN** the tab title contains "Pengajian Al-Ikhlas"

#### Scenario: Login title
- **WHEN** a visitor opens `/login` with `LOGIN_SHOW_ORG_NAME` unset
- **THEN** the tab title is `Masuk · Dahan`

#### Scenario: Public page title
- **WHEN** a visitor opens `/` without a session
- **THEN** the tab title contains "Dahan" and not any organization name

### Requirement: Fallback when organization is missing
If the signed-in user's organization cannot be resolved, or no organization exists when `/login` is rendered, branded surfaces SHALL fall back to "Dahan" instead of failing.

#### Scenario: Empty database
- **WHEN** `/login` is rendered before any organization has been created
- **THEN** the page renders with "Dahan" as the label and no error
