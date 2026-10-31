# Spec Delta

## Purpose

Defines the tag filter on the member list and the activity list/calendar: how selected tags are passed in the URL, resolved on the server, and matched.

## ADDED Requirements

### Requirement: Tag filter parameter
`/dashboard/anggota` and `/dashboard/kegiatan` (list and calendar view) SHALL accept a `tag` URL parameter holding up to `MAX_TAG_FILTER_IDS` comma-separated tag ids. The filter control SHALL offer the tags visible to the user, grouped by owner group, as a multi-select with chips in the tag colors. An empty selection SHALL NOT appear in the URL; changing the selection SHALL return to page 1 and keep the other filters and sort.

#### Scenario: Filter kept in the URL
- **WHEN** a user selects tags 12 and 15 on `/dashboard/anggota`
- **THEN** the URL contains `tag=12,15`, reloading shows the same results, and the pager restarts at page 1

### Requirement: Tag ids resolved on the server
Every tag id from the URL SHALL be resolved on the server. Ids that are malformed, deleted, from another organization, or not visible to the user SHALL be dropped without an error. If no requested id remains, the filter SHALL be treated as empty.

#### Scenario: Invisible tag id dropped
- **WHEN** the URL has `tag=12,99` and tag 99 belongs to a sibling branch
- **THEN** results are filtered by tag 12 only and tag 99 does not appear in the filter control

### Requirement: Any-of matching
With one or more tags selected, an entity SHALL match if it has a link to **any** selected tag. The tag filter SHALL be combined with all other filters (search, group, status, date range) by AND, and SHALL never widen the user's scope. On `/dashboard/kegiatan`, conflict badges SHALL still be computed from all activities, as with the name search.

#### Scenario: Any of two tags
- **WHEN** member M1 has `fokus`, M2 has `prioritas:tinggi`, M3 has neither, and the filter is `fokus` + `prioritas:tinggi`
- **THEN** M1 and M2 are listed and M3 is not

#### Scenario: Filter does not widen scope
- **WHEN** a user filters by an ancestor's tag that is also attached to members outside the user's scope
- **THEN** only members within the user's scope are listed

### Requirement: Tag chips in lists
Members and activities in the member table, the activity list, and the detail pages SHALL show their visible tags as chips. The member table SHALL show tags as a default column ("Tag") that can be hidden like other optional columns.

Saved member views (`/dashboard/tampilan`) SHALL offer the same "Tag" column, as a default column of new views, rendering the viewer's visible tags as read-only chips (no picker). Views already saved keep their stored columns. Tag rules in view filters are not part of this change.

#### Scenario: Hidden tag column
- **WHEN** a user hides the "Tag" column
- **THEN** the member table renders without tag chips and the tag filter still works

#### Scenario: Tag column in a member view
- **WHEN** a member view includes the "Tag" column
- **THEN** each row shows only the tags the viewer may see, as read-only chips, and a view without the column loads no tag data
