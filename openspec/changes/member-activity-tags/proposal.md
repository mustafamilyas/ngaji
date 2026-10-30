# Proposal

## Why

Groups have no way to mark members or activities with their own categories ("fokus", "prioritas:tinggi") and then find them again. The fixed member fields (status, pekerjaan, …) and saved member views (DESIGN.md §12) cover demographics, not ad-hoc labels that each group defines and changes quickly. Tags give every level of the tree a lightweight, colored way to label and filter its own data while staying inside the existing scope and inheritance rules.

## What Changes

- New **Tag** entity owned by one group: a simple tag (`fokus`) or a key–value tag (`prioritas:tinggi`). Each tag/value has its own color from a fixed palette. Tag is soft-deleted.
- Tags are **inherited down the tree** like activities and surveys (DESIGN.md §3.3): a user can *use* a tag owned by their group or any ancestor. A tag chip is *visible* to whoever can see the owner group (`ancestors(G) ∪ scope(U)`, same as `canViewActivity`).
- Only **ADMIN+ of the owning group** creates, renames, recolors and deletes tags and key values. A descendant cannot add values to an ancestor's key, and cannot create a name that already exists on its ancestor chain.
- Any role can **attach/detach** a usable tag to members in scope and to activities they can see (including inherited activities). Key–value tags are **exclusive per key**: attaching `prioritas:rendah` replaces `prioritas:tinggi` on that entity.
- **Quick tagging**: an inline tag picker (search, create inline for ADMIN+) on the member and activity detail pages and on table rows.
- **Bulk tagging** on the member table: select rows → "Tambah tag" / "Hapus tag".
- **Tag filter** (`?tag=`, multiple, *any* semantics) on `/dashboard/anggota`, `/dashboard/kegiatan` (list and calendar) and `/dashboard/kegiatan/cetak`.
- Edge rules: "geser ini & seterusnya" copies tag links; a group that owns undeleted tags is not empty. (`PINDAH` needs no rule: it is only a status, and a member's new row in another group is created by hand.)
- Audit: `tag.create/update/delete`, `member.tag/untag`, `activity.tag/untag` (bulk = one entry).
- Out of scope: tag field in member views, tag statistics, private/per-user tags (added to DESIGN.md §10), bulk tagging of activities.

## Capabilities

### New Capabilities
- `tags`: tag definitions — ownership, key/value model, colors, naming and conflict rules, visibility, management permissions, soft delete, audit.
- `tag-assignment`: attaching/detaching tags to members and activities — eligibility, key exclusivity, inline picker, bulk tagging on the member table, link copying on split and `PINDAH`, audit.
- `tag-filter`: `?tag=` filter on the member list, activity list/calendar — parsing, server-side resolution, visibility, *any* semantics.

### Modified Capabilities
- `activity-schedule-print`: the print page accepts the `tag` parameter with the same meaning as `/dashboard/kegiatan`.

## Impact

- Prisma: new `Tag`, `MemberTag`, `ActivityTag` models + migration. No change to existing columns.
- `lib/authz.ts`: new actions `tag.manage`, `tag.use`, `tag.view`; `lib/resolve.ts`: `resolveTag(s)`.
- New `lib/tag/*` (queries, mutations, validation in `lib/validation/tag.ts`, palette in `lib/constants.ts`).
- Member and activity list queries (`lib/member/queries.ts`, `lib/activity/*`), print page, group-empty check (`lib/group/*`), split (`splitActivity`).
- UI: tag management (group settings tab), tag picker component, member table row selection, filter-bar tag filter.
- DESIGN.md: §2 model, §3.2 matrix, new §13 Tag, §4.5 audit, §7 pages, §10 non-MVP.
