# Spec Delta

## Purpose

Defines how members are linked to each other as family (parent, spouse, sibling, guardian): who may link and unlink, which links are valid, how relatives are labeled, and what a viewer sees of relatives outside their scope.

## ADDED Requirements

### Requirement: Relationship types
A relationship SHALL connect two different members with exactly one of these types:

| Type | Direction | Shown on the first member's page as | Shown on the second member's page as |
|---|---|---|---|
| `ORANG_TUA` | first = parent, second = child | Anak laki-laki / Anak perempuan (by the child's sex) | Ayah / Ibu (by the parent's sex) |
| `WALI` | first = guardian, second = ward | Anak asuh | Wali |
| `PASANGAN` | symmetric | Suami / Istri (by the relative's sex) | Suami / Istri (by the relative's sex) |
| `SAUDARA` | symmetric | Saudara laki-laki / Saudara perempuan (by the relative's sex) | same |

A relationship SHALL be stored once. The inverse SHALL be derived when displayed, never stored as a second record. Any other type value SHALL be rejected.

#### Scenario: Parent link shows on both pages
- **WHEN** a user links Ahmad (L) as `ORANG_TUA` of Fatimah (P)
- **THEN** Fatimah's page lists Ahmad as "Ayah" and Ahmad's page lists Fatimah as "Anak perempuan"

#### Scenario: Symmetric link
- **WHEN** a user links Budi (L) and Siti (P) as `PASANGAN`
- **THEN** Budi's page lists Siti as "Istri", Siti's page lists Budi as "Suami", and only one relationship exists

#### Scenario: Unknown type rejected
- **WHEN** a request links two members with type `KAKEK`
- **THEN** it is rejected with a validation error and nothing is written

### Requirement: Valid pairs
A link SHALL be rejected when:
- both sides are the same member;
- either member is soft-deleted;
- the two members already have a relationship of any type, in either direction (so A cannot be both parent and spouse of B, and A parent of B together with B parent of A is impossible);
- either member already has `RELATION_MAX_PER_MEMBER` relationships.

A member of any status (`AKTIF`, `KELUAR`, …) MAY be linked.

#### Scenario: Self link
- **WHEN** a user links a member to themself
- **THEN** it is rejected and nothing is written

#### Scenario: Reverse parent link
- **WHEN** A is already `ORANG_TUA` of B and a user links B as `ORANG_TUA` of A
- **THEN** it is rejected with "Kedua anggota sudah memiliki hubungan"

#### Scenario: Second type for the same pair
- **WHEN** A and B are `SAUDARA` and a user links them as `PASANGAN`
- **THEN** it is rejected; the existing link must be removed first

#### Scenario: Member who has exited
- **WHEN** a user links an `AKTIF` member to a `KELUAR` member
- **THEN** the link is created

### Requirement: Linking and unlinking permission
A user of any role SHALL be able to link two members, or remove a link between them, only if **both** members are non-deleted and in the user's scope. Both member ids SHALL be resolved on the server. A member outside the user's scope or in another organization SHALL produce 404, and nothing SHALL be written. Removing a link SHALL delete it permanently.

#### Scenario: USER links two members in scope
- **WHEN** a USER of kelompok K links two members of K
- **THEN** the link is created

#### Scenario: Relative outside scope
- **WHEN** a USER of kelompok K1 links a member of K1 to a member of sibling kelompok K2
- **THEN** the response is 404 and no link is created

#### Scenario: Ancestor-level user links across kelompok
- **WHEN** an ADMIN of desa D links a member of kelompok K1 to a member of kelompok K2 (both under D)
- **THEN** the link is created

#### Scenario: Other organization
- **WHEN** a user submits a member id that belongs to another organization
- **THEN** the response is 404

#### Scenario: Unlink an out-of-scope link
- **WHEN** a USER of K1 tries to remove a link between a member of K1 and a member of K2
- **THEN** the response is 404 and the link remains

#### Scenario: Forged link id
- **WHEN** a user submits a link id that does not exist or whose members are not both in scope
- **THEN** the response is 404

### Requirement: Keluarga section on the member page
The member detail page SHALL show a "Keluarga" section with every relationship of the member whose other member is not soft-deleted, ordered by kind (parents/guardians, spouse, siblings, children/wards) and then by name. Each entry SHALL show the derived label, the relative's name and the relative's group name.
- A relative **in the viewer's scope** SHALL link to that relative's detail page.
- A relative **outside the viewer's scope** SHALL show only name, group name and label: no link, and none of the relative's other fields in the page response.

The section SHALL offer "Tambah keluarga" and a remove action only for entries the viewer may change (both members in scope). An empty section SHALL say "Belum ada data keluarga".

#### Scenario: Relative in another kelompok
- **WHEN** a USER of K1 opens a member of K1 whose mother is a member of sibling kelompok K2
- **THEN** the mother appears as "Ibu" with her name and K2's name, without a link or remove action, and her phone, address and birth date are not in the response

#### Scenario: Soft-deleted relative hidden
- **WHEN** a relative is soft-deleted
- **THEN** the relationship is not shown on the other member's page, and the link row is kept

#### Scenario: Mobile width
- **WHEN** the page is viewed at mobile width
- **THEN** the section and the add dialog are usable without horizontal scrolling and meet the touch-size rules

### Requirement: Choosing a relative
The add dialog SHALL let the user pick the relationship type and direction in plain words (e.g. "Ahmad adalah **Ayah/Ibu** dari …", "… adalah **Anak** dari Ahmad") and search the other member by name or member code. Search results SHALL contain only non-deleted members in the user's scope, excluding the member themself, at most `RELATION_PICKER_LIMIT` results, each showing name, group and member code only.

#### Scenario: Search stays in scope
- **WHEN** a USER of K1 searches a name that exists only in sibling kelompok K2
- **THEN** no results are shown

#### Scenario: Search by code
- **WHEN** the user types a full member code of a member in scope
- **THEN** that member is offered

### Requirement: Relationship audit
Every link SHALL write `member.relate` and every removal `member.unrelate` to the audit log in the same transaction, with `meta: { fromMemberId, toMemberId, type }` and `groupId` set to the first member's group. Failed attempts (validation, 404) SHALL NOT write an audit entry.

#### Scenario: Link is audited
- **WHEN** a user links two members
- **THEN** one `member.relate` entry with the user as actor is written

#### Scenario: Removal is audited
- **WHEN** a user removes a link
- **THEN** the link is gone and one `member.unrelate` entry records its members and type
