# Spec Delta

## MODIFIED Requirements

### Requirement: Filter parity with the activity list
The print page SHALL accept the same filter parameters as `/dashboard/kegiatan` (`grup`, `q`, `tag`, `range`, `anchor`, `from`, `to`) with the same defaults and the same tag-id resolution (ids not visible to the user are dropped). It SHALL include exactly the occurrences the list would include for those parameters, before pagination. List-only parameters (`view`, `page`, sort) SHALL be ignored.

#### Scenario: Same occurrences as the list
- **WHEN** a user opens the print page with the same `grup`, `q` and range parameters as a list page showing 70 occurrences over two list pages
- **THEN** the print page shows all 70 occurrences on one page

#### Scenario: Defaults match the list
- **WHEN** a user opens `/dashboard/kegiatan/cetak` with no parameters
- **THEN** it shows the current week (Sunday–Saturday) for the user's own group

#### Scenario: "Cetak" carries the current filters
- **WHEN** a user on `/dashboard/kegiatan` with a group filter, a tag filter, search text and a month range clicks "Cetak"
- **THEN** the print page opens with those same `grup`, `tag`, `q`, `range` and `anchor` values

#### Scenario: Tag filter applies to print
- **WHEN** the print page is opened with `tag=12`
- **THEN** only occurrences of activities linked to tag 12 are shown

#### Scenario: Invisible tag id ignored in print
- **WHEN** the print page is opened with a tag id from a sibling branch
- **THEN** that id is dropped and the page renders as if it were absent
