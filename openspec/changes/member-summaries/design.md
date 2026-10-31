# Design

## Context

See proposal.md (Why). Relevant current state:

- Member views (`lib/member-view/*`, DESIGN.md §12) already compute grouped counts in the DB: `sections.ts` counts per enum value with `groupBy`, per age bucket with `count` + `ageRange()` (birth-date bounds as strings), per org level by rolling leaf counts up the group path.
- `memberStatistics` (`lib/stats.ts`) loads every AKTIF member into memory and counts in JS.
- `activityStatistics` / `activityAttendanceSummary` load every member of the subtree and every occurrence row with attendances, then call `expected()` per occurrence in memory. Participation rows for all members are returned and paginated/sorted in the browser.
- Tags: `Tag(groupId, key, value?)`, links `MemberTag`; visibility via `visibleTagWhere(user)` / `canViewTag` (`lib/tag/access.ts`). Key–value tags are exclusive per (owner group, key) per member (§13.3), so a member has at most one value of a key.

## Goals / Non-Goals

**Goals:** one dimension registry shared by view summaries, Statistik → Anggota and the attendance breakdown; DB-side counting for member summaries; server-side pagination and sorting for attendance tables.

**Non-Goals:** attendance inside view summaries; drill-down from a bucket to members; group-by tag in views; cross-tabs; rewriting `expected()` as SQL (attendance stays in memory, see Risks).

## Decisions

### D1. Dimension registry in `lib/summary/dimensions.ts`
A discriminated union `Dimension`:
`{kind:"property", field: "sex"|"status"|"maritalStatus"|"workStatus"}` · `{kind:"ageBuckets", buckets}` · `{kind:"groupLevel", depth}` · `{kind:"tagKey", tagId}` · `{kind:"tag", tagId}`.
Pure helpers (tested first): bucket list + labels for a dimension, `bucketOf(member)` for in-memory use (attendance), and `bucketWheres(dimension, today)` returning a Prisma `where` per bucket for DB use. The zod schema lives in `lib/validation/summary.ts` and is reused by `member-view.ts` (`summaries: z.array(summarySchema).max(VIEW_MAX_SUMMARIES)`) and by the `?rincian=` / `?tag=` URL parsers.
*Alternative:* reuse `groupBySchema` directly — rejected because group-by has no tag kinds and the two should evolve separately; the age-bucket and group-level sub-schemas are shared.

### D2. Tag keys referenced by an anchor tag ID
`tagKey` stores the ID of any value row of the key; the server resolves it to `(groupId, key)` and loads the key's current visible values. Renaming the key or adding values keeps the summary working; deleting the anchor value while the key survives re-anchors on the next save (load resolves by the anchor row's `groupId`+`key` even if that row is deleted, provided another value of the key is alive).
*Alternative:* store `{groupId, key}` — breaks on key rename and puts a client-supplied group ID in the definition.

### D3. Counting
- Property: one `member.groupBy`. Age buckets: one `count` per bucket + "Lainnya" (`NOT OR`). Org level: existing roll-up. These are extracted from `sections.ts` into `lib/summary/count.ts` and `sections.ts` calls them, so grouping and summaries cannot drift.
- Tag key: one `memberTag.groupBy({ by: ["tagId"], where: { tagId: { in: visibleValueIds }, member: populationWhere } })`; "Tanpa nilai" = total − sum (valid because of exclusivity). Simple tag: one `count` with `tags: { some: { tagId } }`; "Tidak punya" = total − that.
- Statistik → Anggota is rewritten on the same helpers (population = AKTIF in scope subtree).

### D4. Attendance breakdown stays in memory but slimmer
`expected()` depends on per-member dates and per-occurrence dates, so the breakdown is computed in the same loop that already tallies occurrences: the member query selects only the columns needed (`id, name, joinedAt, status, exitedAt, deletedAt, sex, birthDate, maritalStatus, workStatus, groupId`), and, for a tag dimension, one extra `memberTag.findMany` for the subtree restricted to the key's visible value IDs. Each expected member adds to its bucket's expected/hadir/izin.
*Alternative:* SQL aggregation per occurrence — large rewrite of logic that is unit-tested today; deferred until real data shows it is needed.

### D5. Server-side pagination for attendance tables
`participationStatistics` and `activityAttendanceSummary` keep computing all rows (the tally is needed to sort by %), then the page sorts with `lib/sort.ts` (new column lists for participation and per-occurrence) and slices with `lib/pagination.ts` on the server; only the page is passed to client components. Client components lose their local sort/pagination state and render links instead (same pattern as other tables in §7.1). Page params: Statistik `?page=`; activity tab `?kejadian=` (per-occurrence) and `?peserta=` (per-member), matching the per-list param style of `/dashboard/grup/[id]`.

### D6. URL parameters
- Views: summaries live in the definition (and `?d=` drafts); summary-card table pages use `?ringkasan<i>=`.
- Statistik → Anggota: `?tag=<tagId>` (single).
- Breakdown: `?rincian=sex|age|marital|work|tag:<tagId>`; parsed with an allow-list, tag IDs resolved with `visibleTagWhere`.

### D7. Limits in `lib/constants.ts`
`VIEW_MAX_SUMMARIES = 6`, `SUMMARY_MAX_BARS = 12`. Draft length (`VIEW_MAX_DRAFT_LENGTH`) is unchanged; a draft that becomes too long falls back as today.

## Risks / Trade-offs

- [Attendance stats still load the whole subtree's members and occurrence rows into memory] → columns trimmed (D4); monitored via the existing seed + a larger fixture in `pnpm audit:viewport`; SQL aggregation is the next step if a group grows beyond a few thousand members.
- [Bucket by current values, not values at occurrence date] → stated in the UI hint ("berdasarkan data anggota saat ini") and in the spec; historical snapshots are out of scope.
- [Tag-key "Tanpa nilai" relies on exclusivity] → exclusivity is enforced on every attach (§13.3); a test asserts bucket sums equal the total even with a deleted value still linked.
- [Moving client sort to server changes UX on two tables] → same interaction model as `/dashboard/anggota`; layout tests updated.

## Migration Plan

No DB migration. Definitions without `summaries` parse as before. Deploy as a normal release; rollback = previous image (the older lenient parser ignores the unknown `summaries` key silently; it stays in the DB until the view is saved again).
