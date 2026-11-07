# Proposal

## Why

Organizations keep track of families (parents with their newborns, couples, siblings, guardians of children) but Dahan has no way to record who is related to whom. Members also have no short, human-readable identifier: the database id is internal, and a future membership card / QR check-in at the venue needs a stable code that fits on a card. Both are prerequisites for later self-service attendance (family links, card scanning), which is explicitly out of scope here.

## What Changes

- New **member relationship** link between two members of the same organization. Stored types: `ORANG_TUA` (parent → child), `PASANGAN` (spouse, symmetric), `SAUDARA` (sibling, symmetric), `WALI` (guardian → ward). One row per pair and type; the inverse view (child, ward) is derived, never stored twice.
- **Labels by sex**: Ayah/Ibu, Anak laki-laki/perempuan, Suami/Istri, Saudara laki-laki/perempuan, Wali / Anak asuh.
- **Linking rule**: any role may link or unlink two non-deleted members only if **both** are in the user's scope. Self-links, duplicates and contradictory pairs (e.g. A parent of B and B parent of A) are rejected.
- **Viewing rule**: a "Keluarga" section on the member detail page lists all relatives. Relatives outside the viewer's scope show **name and group name only** (no link to their detail page, no other fields).
- Link rows are hard-deleted (like `MemberTag`); every link/unlink is audited. A soft-deleted member's links are hidden, not removed.
- New **member code** `PREFIX-XXXXXX`: `PREFIX` is a per-organization, immutable, globally unique 2–4 letter prefix; `XXXXXX` is 6 random characters from an unambiguous alphabet. Assigned on create (including CSV import), backfilled for existing members, **never changes**, unique across all organizations.
- Member code is shown on the member detail page, can be shown as a column in the member list, and is matched by the member list search (exact code, case-insensitive, dash optional).
- Organization gets `memberCodePrefix`: set at `pnpm org:create` (`BOOTSTRAP_MEMBER_CODE_PREFIX`), backfilled for existing organizations by a one-off script; not editable.
- Out of scope: membership card printing, QR generation, check-in by code, public/self attendance, derived relatives (grandparents, cousins), family tree visualization.

## Capabilities

### New Capabilities
- `member-relations`: relationship types, linking/unlinking permissions and validation, sex-based labels, visibility of out-of-scope relatives, Keluarga section, audit.
- `member-code`: organization prefix, code format and generation, uniqueness, immutability, backfill, display, member-list column and search.

### Modified Capabilities
- None. Member views already reuse the `/dashboard/anggota` column keys (`member-view-query` "Columns"), so the new `kode` column reaches views without a requirement change.

## Impact

- Prisma: `Member.code` (unique), `Organization.memberCodePrefix` (unique), new `MemberRelation` model; migrations + backfill script.
- `lib/authz.ts`: `member.relate` action; `lib/resolve.ts` resolves both members.
- New `lib/member/relations.ts`, `lib/member/code.ts`, `lib/validation/member-relation.ts`; enum `RelationType` in `lib/validation/enums.ts`.
- `lib/member/mutations.ts`, `lib/member/import/*` (code assignment), `lib/member/queries.ts` + `lib/member-view/*` (search, column), `lib/organization/provision.ts` + `from-env.ts`.
- UI: member detail page Keluarga section + add dialog (member picker within scope), code display.
- DESIGN.md: §2 model, §3.2 matrix, §4.5 audit, §7 pages, §10 (relations row moves out of non-MVP), new §14 Relasi & kode anggota; DEPLOYMENT.md (prefix backfill step).
