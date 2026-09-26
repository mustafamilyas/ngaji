# Proposal

## Why

`/kegiatan` (DESIGN.md §7) only supports one view (a flat list), one group at a time, and a manual from/to date range. As the tree grows past a handful of groups, an ADMIN who oversees several kelompok has no way to see their combined schedule in one screen, and there is no at-a-glance monthly view — only a scrollable list. This change extends the existing page rather than the underlying scheduling engine: it reuses `listActivityOccurrences` per selected group and adds a calendar view and richer filtering on top.

## What Changes

- `/kegiatan` gains a **calendar view** (custom Tailwind month grid, no new dependency) alongside the existing list view, switchable via a view toggle.
- The group filter becomes **multi-select**: users pick one or more groups within their scope, with a quick action to select a group and all of its descendants at once.
- Multi-group semantics: for each selected group G, the existing `ancestors(G) ∪ {G} ∪ descendants(G)` rule applies unchanged; results across all selected groups are unioned and de-duplicated by occurrence. No change to `authorize()` or scope rules — every selected `groupId` is still resolved and scope-checked server-side; out-of-scope IDs are dropped, not trusted.
- The manual from/to inputs are replaced by a **range mode toggle**: Hari ini / Minggu ini / Bulan ini / Custom. Custom reveals the existing manual date inputs; the other three compute the range server-side (today; `sundayOf(today)`..+6 as today; calendar month bounds). Default on first visit stays "Minggu ini" (unchanged behavior).
- Prev/next navigation steps by the active mode's unit (day/week/month) and is hidden in Custom mode.
- All filter state (selected groups, view, range mode, custom from/to) lives in URL `searchParams`, kept as a Server Component — no new client-side state store.

## Capabilities

### New Capabilities
- `activity-calendar-view`: `/kegiatan` page behavior — list/calendar view toggle, multi-group selection with a select-descendants shortcut, range mode toggle (today/week/month/custom) with per-mode navigation, URL-driven filter state.

### Modified Capabilities
- `activity-scheduling`: the "Activity list for a group" requirement is extended to accept a set of groups instead of exactly one, defined as the union of the existing per-group rule; single-group behavior (including the default-to-caller's-group case) is preserved as a special case of one selected group.

## Impact

- `app/kegiatan/page.tsx`: filter UI (multi-select + range toggle), view toggle, new calendar rendering.
- `lib/activity/list.ts`: `listActivityOccurrences` takes `groupIds?: number[]` instead of `groupId?: number`; internally resolves+scope-checks each ID and unions the per-group result sets (dedup by `activityId:key`).
- No Prisma schema changes. No changes to `lib/authz.ts` or the permission matrix.
- DESIGN.md §7 (`/kegiatan` row) and §5.3 get a short addendum describing multi-group union and the view/range toggle; no change to §3 (access rules).
