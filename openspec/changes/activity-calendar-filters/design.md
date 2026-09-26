# Design

## Context

`/kegiatan` (app/kegiatan/page.tsx) is a Server Component. It reads `from`/`to`/`grup` from `searchParams`, calls `listActivityOccurrences(session.user, { from, to, groupId })` (lib/activity/list.ts) once for a single target group, and renders a flat list. `groupId` is resolved server-side via `resolveGroup` and the result set is exactly `ancestors(Y) ∪ {Y} ∪ descendants(Y)` (DESIGN.md §5.3). See proposal.md for why this needs to grow to multi-group + calendar.

## Goals / Non-Goals

**Goals:**
- Keep `/kegiatan` a Server Component; no client-side global state, no new runtime dependency for the calendar.
- Reuse the existing per-group occurrence pipeline unchanged; multi-group support is a thin loop + merge on top of it.
- Keep every invariant from CLAUDE.md intact: scope-filtered queries, server-side ID resolution, no trust in client-supplied IDs/paths.

**Non-Goals:**
- No change to `authorize()`, the permission matrix, or what a user is allowed to see/edit/record — this change only changes how many groups can be queried at once for the *list*.
- No day-detail modal/route beyond what's needed to show occurrences already returned by the list query (no new data fetching per calendar cell).
- No persistence of filter preferences (e.g. "remember my last groups") — URL-only state, same as today.

## Decisions

**D1. `listActivityOccurrences` takes `groupIds?: number[]`, loops, and merges.**
Signature changes from `{ groupId?: number }` to `{ groupIds?: number[] }`. Implementation: for each id, run the existing resolve-and-expand logic (unchanged), collect `ActivityListEntry[]`, then dedupe by `` `${activityId}:${key}` `` before returning. Conflict detection (`findConflicts`) runs once over the deduplicated candidate set spanning all selected groups' related activities, so a conflict between two occurrences that both happen to be visible under different selected groups is still caught — this is a strict superset of running it per group. Alternative rejected: a single query with `groupId IN (...)` for the base `Activity` fetch and one shared ancestor/descendant `Group` set — rejected because "ancestors/descendants" is defined per-target-group (§5.3), and two selected groups on different branches don't share a meaningful combined ancestor/descendant set; looping keeps the per-group semantics that are already specified and tested.
Groups outside scope: `resolveGroup` already throws `NotFoundError` for out-of-scope ids for the single-group path (page calls `notFound()`). For the multi-group path this would let one bad id 404 the whole page, which is worse UX for a multi-select filter — so the loop catches `NotFoundError` per id and skips that id rather than aborting, per the "Out-of-scope group id in the URL is ignored" scenario.

**D2. Group picker data + descendant shortcut computed from `path`, not a new query.**
The page already loads `visibleGroupsWhere(session.user)` groups with `path`. "Select group + descendants" is a client-side (checkbox tree) operation over that already-fetched list: expand to `{g.id} ∪ {other groups whose path startsWith g.path}`. No new server round-trip; the shortcut only affects which `grup` values get written to the URL on submit/click.

**D3. Range mode is derived server-side from a `range` param; Custom keeps `from`/`to`.**
`range=hari|minggu|bulan|custom` (URL uses the existing Indonesian terms for consistency with the rest of the UI's URL vocabulary). For `hari`/`minggu`/`bulan`, `from`/`to` are computed from `today()` using existing `lib/dates.ts` helpers (`sundayOf`, `addDays`) plus a new small helper for calendar-month bounds (first/last day of month for a `YYYY-MM-DD` string) — pure, string-in/string-out, alongside the existing functions, tested the same way. For `custom`, `from`/`to` come from the query string as today. Default with no `range` param: `minggu` (preserves current default).

**D4. Calendar view is a pure rendering fork over the same `entries`, not a second data path.**
Both views consume the same `ActivityListEntry[]` from `listActivityOccurrences`. The calendar groups entries by `effectiveDate` into a month grid (weeks starting Sunday, per DESIGN.md). On mobile, cells render as a compact stacked list within each day box (small colored dots/badges) rather than full activity names, consistent with "mobile-first"; tapping a day can jump to that day's slice of the list view (in-page anchor or `?view=list&range=custom&from=D&to=D`) instead of introducing a separate day-detail fetch.

**D5. View toggle (`view=list|calendar`) is also a URL param, list-only when absent.**
Matches D3's approach; keeps everything bookmarkable/shareable per the "Filter state lives in the URL" requirement.

## Risks / Trade-offs

- [Looping `listActivityOccurrences` once per selected group means N similar queries for N selected groups] → acceptable for MVP scale (small trees, few dozen groups); if this becomes a hot path, batch the `Group`/`Activity` fetches by collecting all needed ids across groups first — deferred, not needed at current data volumes.
- [Silently dropping an out-of-scope `grup` id from the URL could mask a bug in the picker UI] → the picker only ever writes ids from the already scope-filtered `visibleGroupsWhere` result, so a dropped id in practice means a stale/tampered URL, not a UI bug; acceptable per the existing "out-of-scope → 404-or-ignore, not trust" invariant.
- [Calendar month grid on very small screens with many occurrences per day] → D4's compact-indicator approach bounds cell height; full detail stays in list view, which remains the primary dense view.

## Migration Plan

No data migration. Rollout is a single deploy: `listActivityOccurrences` signature change is internal (only caller is `app/kegiatan/page.tsx`); the URL contract is additive (`grup` accepts a comma-separated list where it previously accepted one id — old bookmarked single-id URLs keep working). No feature flag needed given the small, single-org deployment model.
