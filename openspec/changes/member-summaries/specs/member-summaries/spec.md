# Spec Delta

## Purpose

Lets a group count members by the dimensions it cares about (sex, age, status, org level, tags) over a population it defines, inside saved member views and on the member statistics page.

## ADDED Requirements

### Requirement: Summary dimensions
A summary SHALL count members per bucket of exactly one dimension:

| Dimension | Buckets (in this order) |
|---|---|
| sex, status, maritalStatus, workStatus | one per enum value, in enum order |
| age buckets | 1–`VIEW_MAX_AGE_BUCKETS` labelled, non-overlapping whole-year ranges (same rules as group-by age buckets; a new one starts from `AGE_BRACKETS`), then "Lainnya" |
| org level | one per group at the chosen depth (from the view group's depth to the leaf depth), ordered by name |
| tag key | one per visible, non-deleted value of the key, ordered by value, then "Tanpa nilai" |
| simple tag | "Punya", "Tidak punya" |

Every member of the population SHALL fall in exactly one bucket, so bucket counts add up to the population total. Age SHALL be the age in whole years on today's date in the organization's time zone. A tag-key or simple-tag dimension SHALL reference a tag the viewer can see; a key is identified by its owner group and key name.

#### Scenario: Buckets add up
- **WHEN** a view's population is 40 members and a summary counts by sex
- **THEN** the "Laki-laki" and "Perempuan" counts add up to 40

#### Scenario: Tag key with members lacking a value
- **WHEN** a summary counts by key `prioritas` (values `tinggi`, `rendah`), 5 members have `tinggi`, 3 have `rendah` and the population is 20
- **THEN** buckets are `rendah` 3, `tinggi` 5, "Tanpa nilai" 12

#### Scenario: Age outside every bucket
- **WHEN** buckets are "Remaja 13–17" and "Pemuda 18–30" and a member is 40
- **THEN** the member is counted in "Lainnya"

#### Scenario: Org level above the viewer rejected
- **WHEN** a user in desa D saves a summary by the daerah level
- **THEN** the save is rejected

### Requirement: Summaries in member views
A member view SHALL show a "Ringkasan" section above its results with one card per summary in `summaries`, in their saved order. Each card SHALL show the dimension's label, the population total, and every non-empty bucket with its count and its share of the total (%), as a bar chart with the numbers also shown as text. The population SHALL be exactly the view's result set (filter + scope + not deleted), independent of grouping, sorting, columns and the current page. Summaries SHALL be edited from the "Tampilan" menu (add, remove, reorder, change dimension) and follow the same draft (`?d=`), save, "Simpan sebagai baru" and owner rules as the rest of the definition.

#### Scenario: Summary follows the filter
- **WHEN** a view filters `status is any of [AKTIF]` and has a summary by age buckets
- **THEN** only AKTIF members in scope are counted

#### Scenario: Unsaved summary change
- **WHEN** the owner adds a summary by sex without saving
- **THEN** the card is shown, the view is marked "Belum disimpan", and nothing is written to the database

#### Scenario: Non-owner cannot save summaries
- **WHEN** a user who is not the view's owner sends a save request that adds a summary
- **THEN** the request is rejected (403) and nothing is written

#### Scenario: Summary not tied to the page
- **WHEN** an ungrouped view has 120 members over three pages and the user is on page 3
- **THEN** the summary still counts all 120

### Requirement: Summaries respect tag visibility and scope
A summary SHALL never count members outside the viewer's scope or deleted members. A tag-key or simple-tag summary whose tag is unknown, deleted, of another organization or not visible SHALL be rejected on save and dropped on load with the notice "Beberapa aturan diabaikan karena tidak berlaku lagi". Values of a key that are deleted or not visible SHALL NOT appear as buckets; members carrying only such a value SHALL be counted in "Tanpa nilai".

#### Scenario: Sibling tag rejected
- **WHEN** a user in kelompok K saves a summary by a tag key owned by sibling kelompok S
- **THEN** the save is rejected and nothing is written

#### Scenario: Deleted value folds into "Tanpa nilai"
- **WHEN** the value `prioritas:sedang` is soft-deleted while 2 members still have a link to it
- **THEN** no "sedang" bucket is shown and those 2 members are counted in "Tanpa nilai"

#### Scenario: Anchor value deleted while the key survives
- **WHEN** a saved tag-key summary was anchored on the value `prioritas:tinggi`, that value is soft-deleted and `prioritas:rendah` is still alive
- **THEN** the view opens without that card and the notice is shown; the owner re-adds the summary to re-anchor it

#### Scenario: Key deleted after saving
- **WHEN** the key used by a saved summary is soft-deleted
- **THEN** the view opens without that card and the notice is shown

### Requirement: Large bucket lists are paginated
A summary card SHALL draw at most `SUMMARY_MAX_BARS` buckets in its chart. When a summary has more buckets than that (org level, tag values), the card SHALL show the chart for the first `SUMMARY_MAX_BARS` buckets and a table of all buckets paginated `EMBEDDED_PAGE_SIZE` per page, each card with its own page parameter. Counts SHALL be computed by the database (grouped counts), never by loading every member of the population.

#### Scenario: Many kelompok
- **WHEN** a daerah view summarizes by kelompok level and there are 45 non-empty kelompok
- **THEN** the chart shows the first `SUMMARY_MAX_BARS` and the table pages through all 45, `EMBEDDED_PAGE_SIZE` at a time

#### Scenario: Paging one card
- **WHEN** the user moves to page 2 of one card's table
- **THEN** the other cards and the member results keep their current page

### Requirement: Tag breakdown on member statistics
Statistik → Anggota SHALL keep its fixed breakdowns (total, sex, marital status, work status, age bracket, direct sub-group) and SHALL add a "Per tag" card where the viewer picks one visible tag key or simple tag (`?tag=` holding one tag ID); its buckets follow the "Summary dimensions" rules over AKTIF, non-deleted members in the chosen scope group. An unusable tag ID SHALL be ignored (no card selection) rather than failing the page. All counts on the tab SHALL be computed by the database.

#### Scenario: Pick a key
- **WHEN** a user in desa D picks key `prioritas` owned by D
- **THEN** the card shows AKTIF members of D's subtree per `prioritas` value plus "Tanpa nilai"

#### Scenario: Invisible tag in URL ignored
- **WHEN** the URL holds `?tag=` with a tag owned by a sibling branch
- **THEN** the page renders with no tag selected and no error

#### Scenario: Out-of-scope group still rejected
- **WHEN** the URL holds `?grup=` with a group outside the viewer's scope
- **THEN** the page responds 404, as before
