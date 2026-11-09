# Spec Delta

## Purpose

Defines how users attach tags to and detach tags from members and activities — who may do it, which tags fit which entity, key exclusivity, the inline picker, and bulk tagging on the member table.

## ADDED Requirements

### Requirement: Usable tags
A user SHALL be able to use (attach or detach) a tag only if the tag's owner group is the user's primary group or one of its ancestors (`ancestors(G) ∪ {G}`), for any role. A tag that is visible but not usable (e.g. owned by a descendant group) SHALL be shown but SHALL NOT be offered in the picker, and attaching or detaching it SHALL be rejected with 403.

#### Scenario: USER uses an ancestor's tag
- **WHEN** a USER in kelompok K attaches desa D's `fokus` (D an ancestor of K) to a member of K
- **THEN** the link is created

#### Scenario: ADMIN above cannot use a descendant's tag
- **WHEN** an ADMIN of desa D attaches kelompok K's `binaan` to a member of K
- **THEN** the request is rejected with 403

### Requirement: Tagging members
A user SHALL attach or detach a usable tag on a member only if the member is not deleted, is in the user's scope, and is in the subtree of the tag's owner group. Any member status (AKTIF, KELUAR, …) MAY be tagged. A member SHALL have at most `TAG_MAX_PER_ENTITY` tags.

#### Scenario: Member outside the tag group's subtree
- **WHEN** a user attaches kelompok K1's tag to a member of sibling kelompok K2
- **THEN** the request is rejected and no link is created

#### Scenario: Member out of scope
- **WHEN** a user submits a member id outside their scope or from another organization
- **THEN** the response is 404

### Requirement: Tagging activities
A user SHALL attach or detach a usable tag on an activity only if the activity is not deleted, the user can see it (DESIGN.md §3.3), and the activity's group is on the tag owner group's ancestor chain or in its subtree. Permission to edit the activity SHALL NOT be required, so a group MAY tag activities it inherits. Each link SHALL be visible according to its tag's visibility. An activity SHALL have at most `TAG_MAX_PER_ENTITY` tags.

#### Scenario: Kelompok tags an inherited activity
- **WHEN** a USER in kelompok K attaches K's `fokus` to pusat activity A (inherited by K)
- **THEN** the link is created, users in K and in K's ancestors see it, and users in sibling kelompok do not

#### Scenario: Activity in an unrelated branch
- **WHEN** a user attaches K1's tag to an activity owned by sibling kelompok K2
- **THEN** the request is rejected (404 if the activity is not visible to the user)

### Requirement: Key values are exclusive
An entity SHALL carry at most one value per (owner group, key). Attaching a key value SHALL remove any other value of the same key from that entity in the same transaction. Simple tags SHALL NOT be exclusive. Attaching a tag already on the entity SHALL change nothing and write no audit entry.

#### Scenario: Value replaced
- **WHEN** a member has `prioritas:tinggi` and a user attaches `prioritas:rendah` from the same owner group
- **THEN** the member has only `prioritas:rendah` and the audit entry records `tinggi` as replaced

#### Scenario: Same key name from sibling branches is not merged
- **WHEN** activity A (owned by desa D) has K1's `prioritas:tinggi` and a user of sibling K2 attaches K2's `prioritas:rendah`
- **THEN** both links exist, each visible only within its own branch and above

### Requirement: Inline tag picker
The member detail page, the activity detail page, and each row of the member and activity tables SHALL show the entity's visible tags as colored chips and, for users who may tag it, a picker to add and remove tags. The picker SHALL list usable tags, searchable by key or `key:value`, show the owner group of tags from ancestor groups, and show values of one key together. For ADMIN or OWNER, typing a name that does not exist SHALL offer "Buat tag" to create it in the user's own group (subject to the tags rules) and attach it in one step. The picker SHALL meet the touch-size conventions on phones.

#### Scenario: USER sees no create option
- **WHEN** a USER types a name that matches no tag
- **THEN** the picker shows no "Buat tag" option

#### Scenario: ADMIN creates and attaches
- **WHEN** an ADMIN types `baru` and chooses "Buat tag"
- **THEN** tag `baru` is created in the ADMIN's group and attached to the entity

### Requirement: Bulk tagging members
The member table (`/dashboard/anggota`) SHALL let users select rows on the current page (at most `PAGE_SIZE`) and apply "Tambah tag" or "Hapus tag" with one usable tag. The server SHALL resolve and check every member id; if any id is out of scope or ineligible, the whole request SHALL be rejected and nothing written. Exclusivity SHALL apply per member. Members for whom the action changes nothing SHALL be skipped, and a member that would exceed `TAG_MAX_PER_ENTITY` SHALL reject the whole request. The result SHALL report how many members changed.

#### Scenario: Bulk add with replacement
- **WHEN** a user selects 10 members, 3 of which have `prioritas:tinggi`, and adds `prioritas:rendah`
- **THEN** all 10 have `prioritas:rendah`, none have `prioritas:tinggi`, and one audit entry lists the 10 member ids and the 3 replaced links as `{memberId, tagId}` pairs

#### Scenario: One ineligible member rejects the batch
- **WHEN** a selection includes a member id outside the user's scope
- **THEN** the request is rejected and no member is changed

### Requirement: Links follow activity splits
When "geser ini & seterusnya" creates a new activity from an existing one, the new activity SHALL receive copies of all the original's tag links (to non-deleted tags), in the same transaction.

#### Scenario: Split copies tags
- **WHEN** activity A has `fokus` and K's `prioritas:tinggi` and an ADMIN splits A from a date
- **THEN** the new activity has both tags and A keeps them

### Requirement: Tag assignment is audited
Every attach or detach SHALL write an audit entry in the same transaction: `member.tag` / `member.untag` and `activity.tag` / `activity.untag`, with `meta` holding the tag id, the affected entity ids, and replaced tag ids. A bulk action SHALL write one entry for the whole batch. The audit `groupId` SHALL be the member's group for a single member, and the tag's owner group for bulk actions and activities.

#### Scenario: Single detach audited
- **WHEN** a user removes `fokus` from a member
- **THEN** one `member.untag` entry is written with the member id and tag id
