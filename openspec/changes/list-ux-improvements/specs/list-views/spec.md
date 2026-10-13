# Spec Delta

## Purpose

Shared conventions for how list pages are laid out, filtered, paginated and displayed.

## ADDED Requirements

### Requirement: Content-only scrolling and collapsible navigation
The app frame SHALL fill the viewport with only the content area scrolling, so the sidebar never scrolls away with long content. On desktop the sidebar SHALL be collapsible to an icon rail, and the choice SHALL persist across reloads without a flash of the other state. On mobile the menu SHALL open as an overlay drawer that closes on navigation, backdrop tap or Escape.

#### Scenario: Long list keeps the sidebar in place
- **WHEN** a user scrolls to the bottom of a 50-row list on desktop
- **THEN** the sidebar, including the user card, stays fully visible

#### Scenario: Collapsed sidebar survives reload
- **WHEN** a user collapses the sidebar and reloads the page
- **THEN** the page renders with the sidebar already collapsed

### Requirement: Standard list filter
List pages SHALL use one filter bar composed of: a name search (`q`), a group filter (`grup`, comma-separated ids) offered as a searchable tree of the groups in scope, a date range (`range`, `anchor`, `from`, `to`) with page-specific presets, custom from/to and previous/next stepping, plus page-specific selects. A date range SHALL be offered only on pages with a natural date (kegiatan, statistik, activity detail, audit). Filter state SHALL live in the URL; empty fields SHALL be omitted and any filter change SHALL reset pagination to page 1. Every group id from the URL SHALL be resolved and scope-checked server-side; on member, user and audit lists an id outside scope SHALL produce 404.

#### Scenario: Several groups including descendants
- **WHEN** a user filters `/dashboard/anggota` by desa D1 and kelompok K5 (K5 not under D1)
- **THEN** members of D1's kelompok and of K5 are listed, and no others

#### Scenario: Out-of-scope id
- **WHEN** `/dashboard/pengguna?grup=<id outside scope>` is requested
- **THEN** the system responds 404

#### Scenario: Stepping a preset range
- **WHEN** the range is "7 hari terakhir" ending today and the user clicks previous
- **THEN** the range becomes the 7 days before that

### Requirement: Pagination on every list where it fits
Every list SHALL be paginated except the attendance form, the group tree and the dashboard previews. Full-page lists SHALL use `PAGE_SIZE`; lists embedded in a detail page SHALL use `EMBEDDED_PAGE_SIZE` with their own page parameter and SHALL NOT scroll the page to the top when paging. A page number past the end SHALL show the last page. The pager SHALL be hidden when everything fits on one page.

#### Scenario: Stale page link
- **WHEN** 120 members match and `?page=9` is requested
- **THEN** page 3 (members 101–120) is shown

#### Scenario: Two lists on one detail page page independently
- **WHEN** a user moves to page 2 of a group's members on `/dashboard/grup/[id]`
- **THEN** the sub-group, activity and user lists stay on their current pages

### Requirement: Selectable member columns
The member table SHALL always show the name and SHALL let the viewer choose which optional columns to show (WhatsApp, group path, sex, birth date with age, status, phone, birth place, address, marital status, work status, email, joined date). The choice SHALL persist per browser and SHALL be re-validated on every request. Only chosen columns SHALL be rendered and sent to the browser.

#### Scenario: Hidden address not sent
- **WHEN** the address column is not chosen
- **THEN** no member address appears in the page's HTML

#### Scenario: Tampered preference
- **WHEN** the stored preference contains unknown column names
- **THEN** they are ignored and only known columns are shown

### Requirement: WhatsApp contact
The member table and member detail page SHALL offer a button that opens a WhatsApp chat (`https://wa.me/<number>`) with the member in a new tab. The stored phone SHALL be normalized (Indonesian `0…`, `62…`, `+62…`, `8…` → `62…`; other countries only when written with `+`); when it cannot be normalized to 10–15 digits, no link SHALL be produced.

#### Scenario: Local number
- **WHEN** a member's phone is "0812-3456-7890"
- **THEN** the button links to `https://wa.me/6281234567890`

#### Scenario: Unusable number
- **WHEN** a member's phone is "12345"
- **THEN** no WhatsApp link is shown for that member

### Requirement: Consistent page layout
Every page with the app frame SHALL open with the shared page header: a breadcrumb (section root first, current page last and not a link; on group pages the group's ancestry, linking only groups inside the viewer's scope), the title with status badges, a row of icon + text facts, and the page's actions on the right (below the title on phones). Header actions SHALL be everyday actions only; irreversible actions (delete, end) SHALL live in a separate "Zona berbahaya" block that explains each consequence. A page with several distinct parts SHALL split them into tabs held in the URL (`?tab=`, default tab omitted); a tab the viewer may not use SHALL NOT be shown, and requesting it SHALL fall back to the default tab.

#### Scenario: Settings tab hidden from USER
- **WHEN** a USER opens `/dashboard/grup/<id>?tab=pengaturan`
- **THEN** the default tab is shown and no rename or delete control is rendered

#### Scenario: Out-of-scope ancestor in the breadcrumb
- **WHEN** a Desa admin opens a Kelompok page
- **THEN** the Pusat and Daerah crumbs show names without links, and the Desa crumb links to its group page

#### Scenario: Only the active tab is rendered
- **WHEN** `/dashboard/grup/<leaf id>` is opened without `?tab=`
- **THEN** the members tab is shown and the group's activities are not in the HTML

### Requirement: Sortable list columns
List tables SHALL let the viewer sort by selected columns through `?sort=<key>&dir=asc|desc`. The key SHALL be checked against the page's whitelist; anything else SHALL fall back to the default order. The default order SHALL NOT appear in the URL, changing the order SHALL return to page 1, and filtering SHALL keep the chosen order. Every order SHALL end with a unique tie-breaker so paging is stable. On `/dashboard/anggota`, only the name and currently visible optional columns SHALL be sortable.

#### Scenario: Toggling a column
- **WHEN** the member list is sorted by name ascending and the user clicks the name header
- **THEN** the list is sorted by name descending, starting at page 1

#### Scenario: Unknown sort key
- **WHEN** `/dashboard/pengguna?sort=passwordHash` is requested
- **THEN** the default order (name ascending) is used

#### Scenario: Sort on a hidden member column
- **WHEN** the birth-date column is hidden and `/dashboard/anggota?sort=tanggalLahir` is requested
- **THEN** the list is ordered by name
