## ADDED Requirements

### Requirement: Activity template
An activity SHALL be owned by one group and have `name`, `location`, optional `notes`, `startTime` (`HH:mm`), `durationMinutes`, `freq` (ONCE/DAILY/WEEKLY/MONTHLY), `interval ≥ 1`, `weekdays` (0=Sunday..6), optional `monthDay`, `startsOn`, optional `endsOn`, optional `continuesFromId`, `deletedAt`. Validation SHALL be a single zod schema shared by form and Server Action with these refinements: `startMinutes + durationMinutes ≤ 1440`; ONCE ⇒ `endsOn = startsOn` and `interval = 1`; WEEKLY ⇒ `weekdays` non-empty, unique, each in 0..6; MONTHLY ⇒ `monthDay` in 1..31; `endsOn ≥ startsOn` when set.

#### Scenario: Crossing midnight rejected
- **WHEN** `startTime = "23:30"` and `durationMinutes = 60`
- **THEN** validation fails

#### Scenario: WEEKLY without weekdays rejected
- **WHEN** `freq = WEEKLY` and `weekdays = []`
- **THEN** validation fails

### Requirement: Recurrence expansion is a pure function
`expandDates(activity, from, to)` SHALL return `YYYY-MM-DD` strings only, with no `Date` objects inside, and SHALL reject ranges longer than 366 days. Rules: ONCE → `[startsOn]`; DAILY → `startsOn + k·interval` days; WEEKLY → weeks start on Sunday, week 0 is the week containing `startsOn`, a date is included when its weekday ∈ `weekdays`, `date ≥ startsOn`, and `weeksBetween(sundayOf(startsOn), sundayOf(date)) mod interval = 0`; MONTHLY → month 0 is `startsOn`'s month, date is `monthDay` of every `interval`-th month, months lacking that day are skipped. All results SHALL satisfy `startsOn ≤ d ≤ endsOn` (if set) and `from ≤ d ≤ to`.

#### Scenario: WEEKLY interval 2 anchored on Sunday
- **WHEN** `startsOn = 2026-09-09` (Wednesday), `weekdays = [0, 3]`, `interval = 2`, range 2026-09-06..2026-09-30
- **THEN** the result is `[2026-09-09, 2026-09-20, 2026-09-23]`

#### Scenario: MONTHLY 31 skips short months
- **WHEN** `monthDay = 31`, `startsOn = 2026-01-31`, range 2026-01-01..2026-05-31
- **THEN** the result is `[2026-01-31, 2026-03-31, 2026-05-31]`

#### Scenario: Range too long
- **WHEN** `to − from > 366 days`
- **THEN** the function throws a validation error

#### Scenario: ONCE outside range
- **WHEN** `freq = ONCE`, `startsOn = 2026-02-01`, range 2026-03-01..2026-03-31
- **THEN** the result is `[]`

### Requirement: Occurrences are materialized lazily and merged by union
`ActivityOccurrence` rows SHALL be created only when attendance is saved or an override is applied, keyed by `(activityId, date)` where `date` is the rule-generated date. `occurrencesFor(activity, from, to, rows)` SHALL return the union of `expandDates` and the dates of rows that have at least one attendance, apply `status`, `overrideDate`, `overrideStartTime`, `overrideDurationMinutes`, `overrideLocation`, `overrideNotes`, compute `effectiveDate = overrideDate ?? date`, and filter by `effectiveDate` in range. Rows with no attendance whose date the rule no longer generates SHALL be ignored.

#### Scenario: History survives a template edit
- **WHEN** an activity's `weekdays` changes from `[2]` to `[4]` and a Tuesday occurrence already has attendance
- **THEN** that Tuesday still appears in the occurrence list

#### Scenario: Orphan without attendance ignored
- **WHEN** a Tuesday occurrence row exists with `status = CANCELLED` and no attendance, and the rule no longer generates Tuesdays
- **THEN** that Tuesday does not appear

#### Scenario: Moved occurrence appears at the new date
- **WHEN** a row has `date = 2026-09-10` and `overrideDate = 2026-09-12`
- **THEN** the occurrence is listed on 2026-09-12 with key 2026-09-10

### Requirement: Inheritance and visibility
An activity owned by group X SHALL apply to X and all its descendants. Activity A SHALL be visible to a user at group G when `A.groupId ∈ ancestors(G) ∪ scope(G)`; otherwise the system SHALL respond 404. The activity list for group Y SHALL include activities with `groupId ∈ ancestors(Y) ∪ {Y} ∪ descendants(Y)` and mark each as `inherited`, `canEdit`, `canRecord`.

#### Scenario: Inherited activity shown read-only
- **WHEN** an ADMIN at kelompok K views an activity owned by its daerah
- **THEN** it is shown with an "warisan" badge and no edit controls

#### Scenario: Sibling-branch activity is 404
- **WHEN** a user at kelompok K1 opens `/kegiatan/[id]` for an activity owned by sibling kelompok K2
- **THEN** the system responds 404

### Requirement: Conflict detection is a warning
Two occurrences SHALL be flagged as conflicting when their `effectiveDate` is equal, their `[effectiveStart, effectiveStart + effectiveDuration)` windows overlap, both are `SCHEDULED`, and one activity's group is an ancestor, self or descendant of the other's. Conflicts SHALL be computed on save (90-day horizon, constant) and on list render, and SHALL never block saving.

#### Scenario: Touching windows do not conflict
- **WHEN** one occurrence is 10:00–11:00 and another 11:00–12:00 on the same date for the same group
- **THEN** no conflict is flagged

#### Scenario: Overlap across hierarchy
- **WHEN** a daerah activity runs 19:00–20:30 and a kelompok under it runs 20:00–21:00 on the same date
- **THEN** both are flagged and the kelompok activity is still saved

#### Scenario: Different branches never conflict
- **WHEN** two sibling kelompok have overlapping activities
- **THEN** no conflict is flagged

### Requirement: Per-occurrence overrides
An editor (see `authorization`) SHALL be able to, for one rule date: cancel (`status = CANCELLED`), change start time / duration / location / notes, or move once by setting `overrideDate` (optionally with new time/duration). Overrides SHALL be accepted only for dates valid per `occurrencesFor(activity, date, date)`. Moving SHALL be rejected when the target date is already an occurrence of the same activity. Cancelling SHALL keep existing attendance rows.

#### Scenario: Move once
- **WHEN** an ADMIN moves the 2026-09-10 occurrence to 2026-09-12 at 20:00
- **THEN** a row with `date = 2026-09-10`, `overrideDate = 2026-09-12`, `overrideStartTime = "20:00"` exists and the attendance URL is still `/kegiatan/[id]/2026-09-10`

#### Scenario: Move onto an existing occurrence rejected
- **WHEN** the target date is already generated by the rule for the same activity
- **THEN** the system rejects with a validation error

#### Scenario: Override on an invalid date rejected
- **WHEN** an override is submitted for a date the rule does not generate and that has no attendance
- **THEN** the system responds 404

### Requirement: Move this and following (split)
For `freq ≠ ONCE`, an editor SHALL be able to change any template property from rule date X onward. If `X ≤ startsOn` the template SHALL be edited in place. Otherwise, in one transaction: set `original.endsOn = X − 1`; create a new activity copying the template with the requested changes, `startsOn` = the new start date, `continuesFromId = original.id`; re-parent all `ActivityOccurrence` rows with `date ≥ X` (and their attendance) to the new activity; write an `activity.split` audit entry.

#### Scenario: Split from the middle
- **WHEN** a weekly activity starting 2026-01-05 is moved from 2026-09-14 onward to Thursdays 19:30
- **THEN** the original ends on 2026-09-13, a new activity starts 2026-09-17 with `continuesFromId` set, and occurrence rows dated ≥ 2026-09-14 belong to the new activity

#### Scenario: Split at or before start edits in place
- **WHEN** X equals `startsOn`
- **THEN** no new activity is created and the original template is updated

### Requirement: End from date and soft delete
"End from date X" SHALL set `endsOn = X − 1`, or soft-delete the activity when `X ≤ startsOn`. Deleting an activity SHALL set `deletedAt`; its occurrences and attendance SHALL be retained but hidden.

#### Scenario: End keeps history
- **WHEN** an activity with attendance in August is ended from 2026-09-01
- **THEN** August occurrences and their attendance remain visible and no occurrences appear from September on
