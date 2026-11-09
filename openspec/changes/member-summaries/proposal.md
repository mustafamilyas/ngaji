# Proposal

## Why

Groups want to answer "how many are women / men, children / teens / elders, how many carry label X" for a population they define themselves, and "who actually attended, broken down the same way". Today the numbers are fixed (Statistik → Anggota, DESIGN.md §6), tags (§13) cannot be counted or used in view rules (deferred in §10), and attendance is only shown as totals. Member data is growing, so the pages that show these numbers must also stop sending whole lists to the browser.

## What Changes

- **Tag rule in member views**: the deferred `tag` field becomes available in view rules (`has any of` / `has none of` visible tags). It never widens scope and only matches tags the viewer can see (§13.2).
- **Shared summary dimensions**: one registry of what can be counted — sex, member status, marital status, work status, age buckets (`AGE_BRACKETS` or custom), org level, a tag key (one bucket per value + "Tanpa nilai"), and a simple tag (Punya / Tidak punya).
- **"Ringkasan" in Tampilan anggota (§12)**: a view definition may hold up to `VIEW_MAX_SUMMARIES` summaries. Each is a count per bucket over the view's filtered population, shown as a chart with numbers. Saved, drafted (`?d=`) and parsed (strict on save, lenient on load) like the rest of the definition; old views keep working.
- **Statistik → Anggota**: keeps its fixed breakdowns, adds a per-tag-key breakdown (viewer picks one visible key). Counts are computed in the database instead of loading every member.
- **Attendance breakdown**: a "Rincian menurut" selector on Statistik → Kegiatan and on the activity detail Absensi tab shows expected / hadir / izin / tidak hadir / % hadir per bucket of one dimension (sex, age bracket, marital status, work status, tag key, simple tag).
- **Server-side pagination** on every list these pages show: participation tables (Statistik → Partisipasi and the activity Absensi tab), the per-occurrence table, and summary / breakdown tables whose bucket count can exceed one page (org level, tag values). Sorting moves to the server with the same `sort`/`dir` rules as §7.1.
- Out of scope (added to DESIGN.md §10): attendance inside view summaries, drilling from a summary bucket into a member list (the view's own "Kelompokkan" covers it), grouping a view by tag, cross-tabulation of two dimensions.

## Capabilities

### New Capabilities
- `member-summaries`: summary dimensions, the "Ringkasan" section in member views, and the per-tag-key breakdown on Statistik → Anggota — buckets, labels, visibility of tag buckets, counting rules, limits, pagination of large bucket lists.
- `attendance-breakdown`: "Rincian menurut" on Statistik → Kegiatan and the activity Absensi tab — dimensions, per-bucket attendance numbers, scope, and server-side pagination of the participation and per-occurrence tables.

### Modified Capabilities
- `member-view-query`: definition shape gains optional `summaries`; fields gain the `tag` rule with its operators, visibility and lenient-load behavior.

## Impact

- `lib/member-view/*`: `fields.ts` (tag field), `query.ts` (tag rule → `tags: { some }`), `sections.ts` (bucket counting extracted for reuse), new `summaries.ts`; `lib/validation/member-view.ts` (tag rule value, `summaries` schema, lenient parsing).
- New `lib/summary/*`: dimension registry (pure, tested first) and DB-side bucket counting.
- `lib/stats.ts`: `memberStatistics` rewritten with `groupBy`/`count`; attendance breakdown added to `activityStatistics` / `activityAttendanceSummary`; participation results paginated and sorted on the server.
- UI: view menu "Ringkasan" editor + summary cards (`app/dashboard/tampilan/*`), Statistik tabs, activity Absensi tab (`app/dashboard/kegiatan/[id]/*`), Recharts bar charts.
- `lib/constants.ts`: `VIEW_MAX_SUMMARIES`, `SUMMARY_MAX_BARS`.
- No schema migration (definitions are JSON; tags already exist). No new audit actions (view saves already audit the definition).
- DESIGN.md §6, §7, §10, §12, §13 updated in the same commit.
