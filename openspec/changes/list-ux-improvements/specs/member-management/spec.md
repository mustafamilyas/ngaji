# Spec Delta

## MODIFIED Requirements

### Requirement: List, search, filter, pagination
The member list SHALL be scope-filtered, searchable by name (case-insensitive substring), filterable by one or more groups in scope (each including its descendants) and by status, and paginated with `PAGE_SIZE` (constant, 50) via `?page=`; a page past the end SHALL show the last page. It SHALL be shown as a table with selectable columns and a WhatsApp action (see `list-views`). The member detail page SHALL offer the same WhatsApp action and paginate the attendance history with `EMBEDDED_PAGE_SIZE` via `?riwayat=`.

#### Scenario: Third page
- **WHEN** 120 members match and `?page=3` is requested
- **THEN** members 101–120 are shown with the total count 120

#### Scenario: Filter by group outside scope
- **WHEN** the `grup` filter names a group outside scope
- **THEN** the system responds 404

#### Scenario: Union of selected groups
- **WHEN** the `grup` filter names two in-scope groups
- **THEN** members of either group (or their descendants) are listed
