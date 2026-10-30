# Spec Delta

## Purpose

Defines tags: group-owned, colored labels (simple `fokus` or key–value `prioritas:tinggi`) that a group and its descendants use to label members and activities, and who may see and manage them.

## ADDED Requirements

### Requirement: Tag model and naming
A tag SHALL belong to exactly one non-deleted group (the owner) in the user's organization, taken from the creating user's own group, never from the client. A tag SHALL be either a **simple tag** (a key only, e.g. `fokus`) or a **key value** (a key plus a value, e.g. `prioritas` + `tinggi`, written `prioritas:tinggi`). A key that has values SHALL NOT also exist as a simple tag in the same owner group. Keys and values SHALL be trimmed, lowercased, 1–`TAG_MAX_PART_LENGTH` characters, made of letters, digits, spaces, `-` and `_` (no `:`). Typing `a:b` in a tag input SHALL be read as key `a`, value `b`.

#### Scenario: Key value parsed from input
- **WHEN** an ADMIN types ` Prioritas : Tinggi ` and creates it
- **THEN** a tag with key `prioritas` and value `tinggi` is created in the ADMIN's group

#### Scenario: Invalid name rejected
- **WHEN** a tag with key `a:b:c` or an empty value is submitted
- **THEN** the request is rejected with a validation message and nothing is written

#### Scenario: Simple tag and key cannot share a name
- **WHEN** a group already has values under key `prioritas` and an ADMIN creates simple tag `prioritas` in the same group
- **THEN** the request is rejected

### Requirement: Names are unique along the ancestor chain
Among non-deleted tags, a key SHALL NOT be created in group G if the same key (case-insensitive) exists in G or in any ancestor of G. A value SHALL be unique within its (owner group, key). Values SHALL only be added to a key by its owner group: a descendant SHALL NOT add a value to an ancestor's key. Tags in sibling branches MAY share a name. The name of a deleted tag MAY be reused.

#### Scenario: Ancestor already owns the key
- **WHEN** desa D owns key `prioritas` and an ADMIN of kelompok K under D creates `prioritas:mendesak`
- **THEN** the request is rejected with a message naming the existing tag's owner group

#### Scenario: Sibling branches may reuse a name
- **WHEN** kelompok K1 owns `fokus` and an ADMIN of sibling kelompok K2 creates `fokus`
- **THEN** the tag is created in K2

#### Scenario: Reusing a deleted name
- **WHEN** group G's tag `fokus` was deleted and an ADMIN of G creates `fokus`
- **THEN** a new tag is created

### Requirement: Tag colors
Every simple tag and every key value SHALL have its own color chosen from a fixed palette (`TAG_COLORS`); any other value SHALL be rejected. Values of the same key MAY have different colors. Tag chips SHALL render the key (and `:value`) as text so the tag remains identifiable without color, including in print.

#### Scenario: Each value has its own color
- **WHEN** `prioritas:tinggi` is red and `prioritas:rendah` is green
- **THEN** chips for each value show their own color

#### Scenario: Color outside the palette rejected
- **WHEN** a tag is submitted with color `#ff00ff`
- **THEN** the request is rejected

### Requirement: Tag visibility
A user SHALL see a tag (its chip, its definition, and its links) only if the tag's owner group is on the user's ancestor chain or in the user's scope (`ancestors(G) ∪ scope(U)`). A tag from another organization or another branch SHALL be treated as non-existent (404). Deleted tags SHALL NOT be shown anywhere and SHALL be treated as non-existent.

#### Scenario: Descendant sees an ancestor's tag
- **WHEN** desa D owns `fokus` and a USER in kelompok K under D opens a member tagged `fokus`
- **THEN** the `fokus` chip is shown

#### Scenario: Ancestor sees a descendant's tag
- **WHEN** kelompok K owns `binaan` and an ADMIN of desa D (K in scope) views a K member tagged `binaan`
- **THEN** the `binaan` chip is shown

#### Scenario: Sibling branch cannot see the tag
- **WHEN** kelompok K1 tagged the inherited pusat activity A with K1's `fokus` and a user in sibling kelompok K2 opens A
- **THEN** K1's `fokus` chip is not shown and requesting that tag by id returns 404

### Requirement: Managing tags
Only users with role ADMIN or OWNER whose primary group is the tag's owner group SHALL create, rename, recolor, or delete a tag or key value. Renaming a key SHALL rename it on every value of that key; the new name SHALL satisfy the naming and uniqueness rules. Deleting SHALL be a soft delete; deleting a key SHALL delete all its values. Links to a deleted tag SHALL stop being shown and filtered on. Extra ADMIN roles (DESIGN.md §3.2a) SHALL NOT grant tag management. The owner group's tags SHALL be listed on the group detail page for every user who can see that group; management controls SHALL be shown only to users allowed to manage.

#### Scenario: ADMIN of the owner group recolors
- **WHEN** an ADMIN of group G changes the color of G's `fokus`
- **THEN** the color is saved and audited

#### Scenario: USER cannot manage
- **WHEN** a USER of group G submits a create, rename, recolor, or delete for a tag of G
- **THEN** the request is rejected with 403 and nothing is written

#### Scenario: ADMIN of an ancestor cannot manage a descendant's tag
- **WHEN** an ADMIN of desa D submits a recolor for kelompok K's tag (K under D)
- **THEN** the request is rejected with 403

#### Scenario: ADMIN of a descendant cannot manage an ancestor's tag
- **WHEN** an ADMIN of kelompok K submits a delete for desa D's tag
- **THEN** the request is rejected with 403

#### Scenario: Deleting a key removes its values from view
- **WHEN** an ADMIN deletes key `prioritas`
- **THEN** no `prioritas:*` chip is shown on any member or activity and `prioritas` values are no longer offered in pickers or filters

### Requirement: Tag limits
A group SHALL own at most `TAG_MAX_PER_GROUP` non-deleted tags (simple tags and key values counted together). Creating beyond the limit SHALL be rejected.

#### Scenario: Limit reached
- **WHEN** a group already owns `TAG_MAX_PER_GROUP` tags and an ADMIN creates another
- **THEN** the request is rejected with a message about the limit

### Requirement: Groups owning tags are not empty
A group that owns at least one non-deleted tag SHALL NOT be deletable, in addition to the existing emptiness rules.

#### Scenario: Delete blocked by tags
- **WHEN** an ADMIN deletes a group that has no children, members, activities, or users but owns tag `fokus`
- **THEN** the deletion is rejected with a message that the group still owns tags

### Requirement: Tag management is audited
Every tag mutation SHALL write an audit entry in the same transaction: `tag.create` (after = key, value, color), `tag.update` (before/after of the changed rows; a key rename is one entry), `tag.delete` (before = the deleted rows). The audit `groupId` SHALL be the owner group.

#### Scenario: Key rename is one audit entry
- **WHEN** an ADMIN renames key `prioritas` that has three values
- **THEN** exactly one `tag.update` entry is written listing the three rows before and after
