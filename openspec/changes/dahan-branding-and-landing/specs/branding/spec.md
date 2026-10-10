# Spec Delta

## Purpose

Defines how the product name Dahan and each organization's own name appear in the app, so members see their organization first and the product brand second.

## ADDED Requirements

### Requirement: Product name is Dahan
User-facing text SHALL use "Dahan" as the product name; the string "Ngaji" SHALL NOT appear in any rendered page, document title or favicon.

#### Scenario: No old name in UI
- **WHEN** any page (public or logged-in) is rendered
- **THEN** the visible text and `<title>` do not contain "Ngaji"

### Requirement: Organization name first inside the app
In the app shell sidebar (desktop and mobile drawer) and on the login page, the system SHALL show the organization's name (`Organization.name` of the deployment) as the primary label and a secondary "oleh Dahan" mark. The organization name SHALL come from the server, never from client input.

#### Scenario: Sidebar label
- **WHEN** a logged-in user views any app page on a deployment whose organization is "Pengajian Al-Ikhlas"
- **THEN** the sidebar shows "Pengajian Al-Ikhlas" with "oleh Dahan" beneath it

#### Scenario: Collapsed sidebar
- **WHEN** the desktop sidebar is collapsed to icons
- **THEN** only the logo mark is shown and its accessible name contains the organization name

#### Scenario: Login page
- **WHEN** a visitor opens `/login`
- **THEN** the page shows the organization name and "oleh Dahan" above the form

### Requirement: Document title
Logged-in pages and `/login` SHALL have the document title `<page> · <organization name>` where a page name exists, otherwise `<organization name> · Dahan`. Public pages SHALL use a title with "Dahan" and no organization name.

#### Scenario: App page title
- **WHEN** a logged-in user opens the dashboard on the "Pengajian Al-Ikhlas" deployment
- **THEN** the tab title contains "Pengajian Al-Ikhlas"

#### Scenario: Public page title
- **WHEN** a visitor opens `/` without a session
- **THEN** the tab title contains "Dahan" and not the organization name

### Requirement: Fallback when organization is missing
If the deployment has no organization row, branded surfaces SHALL fall back to "Dahan" instead of failing.

#### Scenario: Empty database
- **WHEN** `/login` is rendered before bootstrap has created an organization
- **THEN** the page renders with "Dahan" as the label and no error
