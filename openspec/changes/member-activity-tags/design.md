# Design

## Context

See proposal.md for motivation and specs/ for behavior. Constraints that shape the approach:
- SQLite + Prisma 7; no enums (string columns validated by zod), no partial unique indexes we rely on from Prisma.
- Scope is a materialized path (`group.path`, trailing `/`); "ancestors of G" = the ids in `G.path`. Visibility helpers for activities already exist (`canViewActivity`, DESIGN.md §3.3); tags reuse the same shape.
- Every mutation goes through `authorize()` and writes `audit(tx, …)` in the same transaction. Group/Member/Activity are soft-deleted only.
- Members never change group (no edit of `groupId`; `PINDAH` is only a status and any new row is created by hand). Groups never change parent. So "member is in the tag group's subtree" is stable once true.

## Goals / Non-Goals

**Goals:** one tag table for simple and key-value tags; visibility/usability derived from paths without extra joins on hot list queries; exclusivity enforced in the same transaction as the attach.

**Non-Goals:** tag rule in member views (§12), tag statistics, private tags, bulk tagging of activities, cross-page "select all results" for bulk.

## Decisions

### D1. One `Tag` row per simple tag or per key value
```prisma
model Tag {
  id          Int       @id @default(autoincrement())
  groupId     Int       // owner
  key         String    // normalized: trimmed, lowercased
  value       String?   // null = simple tag
  color       String    // TagColor
  createdById Int
  deletedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  @@index([groupId, deletedAt])
  @@index([key])
}
model MemberTag   { memberId Int; tagId Int; createdById Int; createdAt DateTime @default(now()); @@id([memberId, tagId]); @@index([tagId]) }
model ActivityTag { activityId Int; tagId Int; createdById Int; createdAt DateTime @default(now()); @@id([activityId, tagId]); @@index([tagId]) }
```
A key is not its own row: it is the set of `Tag` rows sharing `(groupId, key)` with `value != null`. Renaming a key = `updateMany` on that set. *Alternative:* `TagKey` + `TagValue` tables — cleaner normalization, but doubles the queries/joins on every chip render and every filter for a feature where keys rarely have more than a handful of values. Rejected.

Description field from the first analysis is dropped (not requested; avoid unused PII-free text). Can be added later without migration pain.

### D2. Uniqueness checked in app, inside the create/rename transaction
SQLite unique indexes can't express "among non-deleted rows on the ancestor chain". The mutation, inside `$transaction`, queries non-deleted tags with `groupId IN ancestorIds(G) ∪ {G}` and the same key, then inserts. SQLite serializes writers, so the check-then-insert is race-free within one transaction. Same pattern as group sibling names and member-view names.

Known gap: if an ancestor later creates a key a descendant already owns, both exist. Accepted: pickers label ancestor tags with their owner group, and exclusivity is per (owner, key) so semantics stay well-defined.

### D3. Visibility and usability as pure functions over paths
In `lib/tag/access.ts` (tested first):
- `canViewTag(user, tag)` = `tag.group.path` is a prefix of `user.groupPath` (ancestor or self) **or** starts with `user.groupPath` (in scope).
- `canUseTag(user, tag)` = `tag.group.path` is a prefix of `user.groupPath`.
- `canTagMember(user, tag, member)` = `canUseTag` ∧ member in scope ∧ `member.group.path.startsWith(tag.group.path)`.
- `canTagActivity(user, tag, activity)` = `canUseTag` ∧ `canViewActivity` ∧ (`tag.group.path.startsWith(activity.group.path)` ∨ `activity.group.path.startsWith(tag.group.path)`).

For list rendering, `visibleTagWhere(user)` builds one Prisma `where` on `tag.group` (`path in ancestorPaths` OR `path startsWith scopePath`) plus `deletedAt: null`, used in the `include` of member/activity tag links. For members the scope condition is always true for in-scope members, but the same helper is used for both to keep one rule.

`authorize()` gains `tag.manage` (target: tag owner group id; ADMIN+ with `user.groupId === groupId`, primary role only) and `tag.use` (delegates to the pure functions above). Out-of-visibility → 404 via `resolveTag`; visible-but-not-usable → 403.

### D4. Exclusivity in the attach transaction
`attachTag(tx, entity, tag)`: if `tag.value != null`, delete links on that entity whose tag has the same `groupId` + `key` and a different id, collect them as `replacedTagIds`, then `upsert`/`createMany` the new link (skip if present). Bulk does the same with `deleteMany` over `memberId IN ids` and one `createMany`. Link rows are hard-deleted: they are associations, not records (same as replacing attendance), and every removal is captured in the audit `meta`.

### D5. Filtering
`?tag=` parsed by a new `parseIdList` use in `lib/filters.ts` (same shape as `grup`), capped at `MAX_TAG_FILTER_IDS`. Server resolves ids with `resolveVisibleTags` (drop-not-404, like the activity group filter). Member query adds `tags: { some: { tagId: { in: ids } } }`. Activity list filters the activity set before occurrence expansion, so conflicts (computed over all activities) are untouched — same place `q` is applied today. Print reuses the list's filter parser.

### D6. UI
- `components/tags/tag-chip.tsx` (color token → Tailwind classes map, text always shown, `print:` black border).
- `components/tags/tag-picker.tsx`: shadcn `Popover` + `Command` (combobox); options grouped "Grup sendiri" / owner group name; `key:value` search; "Buat tag" row for ADMIN+. Calls Server Actions `attachTag` / `detachTag` / `createAndAttachTag`; optimistic update with `useOptimistic`, revalidate on settle.
- Group detail gets a `?tab=tag` tab: list of owned tags (chips grouped by key), manage dialog for ADMIN+ of that group.
- Member table: checkbox column (client component wrapping the existing server-rendered rows' ids) + sticky action bar "Tambah tag" / "Hapus tag" with the picker in single-select mode. Selection is per page; changing page clears it.
- Palette `TAG_COLORS` in `lib/constants.ts`: `slate, red, orange, amber, green, teal, blue, indigo, purple, pink`, each with checked-contrast light classes.

### D7. Audit `groupId`
`tag.*` → owner group. `member.tag/untag` single → member's group (shows up where the member lives). Bulk member and all activity actions → tag owner group (one group per entry; an activity link is the tagging group's data).

## Risks / Trade-offs

- [Chip visibility adds a join on every member/activity list] → links filtered via `include: { tags: { where: { tag: visibleTagWhere } } }`; `MemberTag(tagId)` and `Tag(groupId, deletedAt)` indexes; list pages are already paginated to 50.
- [Inherited activity collects many tags from many kelompok] → each user only sees their chain + scope; `TAG_MAX_PER_ENTITY` bounds the worst case. Top-level OWNER sees all — acceptable, it's their data.
- [Ancestor creates a name that a descendant already owns] → see D2; labeled by owner in picker.
- [Bulk request with up to 50 ids × exclusivity] → single transaction, `deleteMany` + `createMany`; trivial for SQLite.
- [Hard-deleting link rows departs from "no hard delete"] → invariant in CLAUDE.md is scoped to Group/Member/Activity/User; documented in DESIGN.md §13 and fully audited.

## Migration Plan

Additive migration (three new tables). No backfill. Rollback = deploy previous build; tables are ignored by old code. Release doc per `docs/releases/TEMPLATE.md`.
