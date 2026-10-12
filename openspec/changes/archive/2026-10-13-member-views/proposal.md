# Proposal

## Why

The `/anggota` table only filters by name, group and status, and every user rebuilds the same lists by hand each time (e.g. "active teenagers 13–17 in desa X, grouped by age"). Groups need saved, shareable member lists with richer rules — especially by age — that the whole group can reopen, similar to views in Linear.

## What Changes

- **Saved member views** (`MemberView`): a named, saved query over members, owned by the creator's group. Any account can create one.
- **Group visibility only**: a view is visible to users whose group is exactly the view's group — not to groups above or below (unlike the scope rule in DESIGN.md §3.1). Results are always limited to the viewer's scope.
- **Creator-only editing**: only the creator edits or deletes; when the creator is deactivated or no longer in that group, an ADMIN/OWNER of the group can take the view over.
- **Rules**: one level of nesting — rule groups joined by AND/OR, each group's rules joined by AND/OR. Typed operators per field: choice fields (is any of / is none of), text (contains / equals), dates (before / after / between / within the last N days), **age** (=, ≠, >, ≥, <, ≤, between; derived from `birthDate`), org group (in subtree of).
- **Sort**: one key + direction, with a stable tie-breaker.
- **Group by**: a property (status, sex, work status, marital status, org group at a chosen level) or **age buckets** (start from `AGE_BRACKETS`, editable per view; unmatched → "Lainnya"). Collapsible sections with counts, each showing the first N members with "Tampilkan lebih banyak".
- **Columns** saved per view, with the same column set as `/anggota` (DESIGN.md §7.1).
- **PII guard**: phone, address and email can never be filtered, grouped or sorted on.
- **Unsaved edits** live in the URL; "Simpan" (owner) or "Simpan sebagai baru" (anyone).
- **Pages**: `/tampilan` (list), `/tampilan/baru`, `/tampilan/[id]`; sidebar item "Tampilan".
- Prepared for later (not built): private views (`visibility`), other data sources (`source`).

## Capabilities

### New Capabilities
- `member-views`: saving, loading, visibility, ownership/takeover, soft delete, unsaved drafts and the view pages.
- `member-view-query`: the view definition — rules and operators, age computation, sort, group-by (properties and age buckets), columns, PII-restricted fields, stale-rule handling and scoped results.

### Modified Capabilities
- `authorization`: permission matrix gains `member_view.*` actions.
- `audit-log`: logged actions gain `member_view.create/update/delete/transfer`.

## Impact

- **Schema**: new model `MemberView` (`groupId`, `ownerId`, `createdById`, `name`, `source`, `visibility`, `definition` Json, `deletedAt`); relations on `Group` and `User`. One migration; seed gains sample views.
- **Code**: `lib/member-view/*` (definition schema, age → date math, query builder, grouping — tests first), `lib/validation/member-view.ts`, `lib/authz.ts` actions + cross-scope tests, `lib/resolve.ts`, `app/tampilan/*`, nav item in `lib/nav.ts`, new limits in `lib/constants.ts`.
- **Security**: the saved definition is client input — re-validated on every save and load, field names resolved through a server whitelist, group IDs resolved and scope-checked; PII fields blocked.
- **Docs**: DESIGN.md §2, §3.2, §3.5, §4.5, §7 and a new section for views (done in the implementation, not in this proposal step).
- No change to existing `/anggota` behaviour.
