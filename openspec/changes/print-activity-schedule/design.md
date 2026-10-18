# Design

## Context

`/dashboard/kegiatan/page.tsx` already resolves filters (`resolveDateRange`, `parseGroupIds`, `parseSearch`) and calls `listActivityOccurrences(session.user, { from, to, groupIds, search })`, which does the per-group scope checks and the union of DESIGN.md §5.3. It returns `ActivityListEntry[]` plus the resolved `groups`. All signed-in routes live under `app/dashboard/`, wrapped by `NavShell` (`app/dashboard/layout.tsx`). There are no print styles in the app yet.

## Goals / Non-Goals

**Goals:**
- A printable schedule with the same data as the list, reached from the list in one click.
- No new query path: reuse `listActivityOccurrences` so scope behaviour cannot diverge.
- Server-rendered. The only client JS is the print button.

**Non-Goals:**
- Server-side PDF generation, or downloading/exporting files (CSV/Excel).
- A printable calendar grid, or printing a single activity's 90-day schedule (`/dashboard/kegiatan/[id]`).
- Custom branding or organisation letterhead beyond the organisation name.

## Decisions

1. **Dedicated route under the dashboard, not print CSS on the list page.** The list page is paginated and full of management UI, and hiding all of that with print CSS would be fragile. `app/dashboard/kegiatan/cetak/page.tsx` stays inside the dashboard layout, so it gets auth and the shell on screen. `print:hidden` on `NavShell`'s sidebar and top bar removes them on paper. *Alternative:* a route group outside `/dashboard` with its own bare layout. Rejected because all signed-in routes were just moved under `/dashboard`, and it would duplicate the auth and layout wiring.

2. **Pure helper `groupScheduleByDate(entries, { showCancelled })`** in `lib/activity/print.ts`. It filters out cancelled entries when needed, sorts by `effectiveDate`, then `effectiveStartTime`, then `activityName`, and returns `{ date, entries }[]`. The end time is computed with a small pure `endTimeOf(start, durationMinutes)`. If an existing helper already formats time ranges, use that instead. Written test-first, as the project requires for pure functions.

3. **Range cap is checked before querying.** The page resolves the range with `ACTIVITY_LIST_DATE_RANGE` and then checks `to < addMonthsClamped(from, PRINT_MAX_MONTHS)`. The clamping matters because `addMonthsOnDay` returns null for missing days: 31 Jan + 1 month clamps to the end of February. If the check fails, the page renders the message and never calls `listActivityOccurrences`. Preset modes (day/week/month) always pass. Implement this as a pure `isWithinMonths(from, to, months)` in `lib/dates.ts` with tests, including month-end edge cases.

4. **`batal` parsing.** `params.batal === "0"` → hide. Anything else → show. The toggle is a `<Link>` that flips the value while keeping the other params, so there is no client state.

5. **Print styling.** Tailwind `print:` variants handle hide and show. `app/globals.css` gets `@media print { @page { size: A4; margin: 15mm } }`. Under print it also forces `color-scheme: light` and the light token values on `:root`, so the dark theme prints black-on-white. Each date section uses `break-inside: avoid` where it fits, and table headers repeat across pages (`thead { display: table-header-group }`).

6. **Header label** reuses the list's `groupsLabel` logic: one group name, or "N grup". The date range uses `formatDateRange`, and the organisation name comes from `getOrganizationName()`.

7. **Entry point.** `/dashboard/kegiatan` gets an outline "Cetak" link in the `PageHeader` actions, built from the existing `hrefWith` filter params with the path changed to `/dashboard/kegiatan/cetak` and `view`, `page` and sort dropped.

## Risks / Trade-offs

- **Browser print differences** (margins, header and footer URL lines) are outside our control. This is acceptable for an MVP handout. Users can turn off headers and footers in the dialog.
- **Large result sets:** 3 months for a top-level group can mean hundreds of rows on a single page. Server rendering handles that fine, and the cap prevents runaway ranges.
- **`print:hidden` on `NavShell`** affects printing every dashboard page. That is harmless and probably an improvement, but worth knowing.
- **Conflict badges are omitted** on paper. The printout is for attendees, not for schedule management.
