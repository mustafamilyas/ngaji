# Tasks

## 1. Dimensions (pure, tests first)

- [ ] 1.1 Add `VIEW_MAX_SUMMARIES` and `SUMMARY_MAX_BARS` to `lib/constants.ts`; verify `pnpm tsc --noEmit` passes
- [ ] 1.2 Write `lib/validation/summary.ts` (dimension + summary zod schemas, sharing age-bucket and group-level sub-schemas with `member-view.ts`) with tests for valid kinds, overlapping buckets, unknown kind, extra keys; verify `pnpm test lib/validation`
- [ ] 1.3 Write `lib/summary/dimensions.ts` (bucket list/labels, `bucketOf(member, today, tagLinks)`, `bucketWheres(dimension, today)`) test-first, covering enum order, "Lainnya", 29 Feb birthdays, "Tanpa nilai", simple tag; verify `pnpm test lib/summary`
- [ ] 1.4 Parse `?rincian=` and single `?tag=` with an allow-list in `lib/filters.ts` with tests for invalid values; verify `pnpm test lib/filters`

## 2. Tag rule in member views

- [ ] 2.1 Add `tag` field (`hasAnyOf`/`hasNoneOf`, not sortable/groupable) to `lib/member-view/fields.ts` and the rule value parser; tests for operator/value validation; verify `pnpm test lib/member-view/fields lib/validation`
- [ ] 2.2 Translate tag rules in `lib/member-view/query.ts`, restricted to visible tag IDs; tests incl. "has none of" matching untagged members; verify `pnpm test lib/member-view/query`
- [ ] 2.3 Resolve tag IDs on save (reject unknown/deleted/other org/invisible) and on load (drop + notice) next to group-ID resolution; server-action tests for sibling, other-org, deleted, inherited and descendant tags; verify `pnpm test app/dashboard/tampilan lib/member-view`
- [ ] 2.4 Tag picker in the rule editor (`rule-editor.tsx`) using visible tags; verify in `pnpm dev:scratch` and a `*.test.tsx`

## 3. DB-side counting

- [ ] 3.1 Extract property / age-bucket / group-level counting from `lib/member-view/sections.ts` into `lib/summary/count.ts`; existing `sections.test.ts` still passes unchanged
- [ ] 3.2 Add tag-key and simple-tag counting (`memberTag.groupBy`, totals − sum) with query tests: bucket sums equal total, deleted value folds into "Tanpa nilai", out-of-scope members never counted; verify `pnpm test lib/summary`
- [ ] 3.3 Rewrite `memberStatistics` on the shared counters (no `findMany` of all members) and add the optional tag breakdown; `lib/stats.queries.test.ts` updated and passing

## 4. Summaries in member views

- [ ] 4.1 Add `summaries` to `definitionSchema` and lenient parsing (drop invalid entries with a warning); resolve tag anchors per design D2; tests for old definitions without `summaries`, too many summaries, invisible tag; verify `pnpm test lib/validation lib/member-view`
- [ ] 4.2 `lib/member-view/summaries.ts`: compute every summary over `prepareView`'s population, paginating bucket tables beyond `SUMMARY_MAX_BARS`; tests for scope, org level above viewer rejected, independence from page/grouping; verify `pnpm test lib/member-view`
- [ ] 4.3 "Ringkasan" cards (Recharts bar + numbers + paginated table, `?ringkasan<i>=`) in `view-page.tsx`, and the summary editor in the "Tampilan" menu (add/remove/reorder/dimension, age bucket editor reused); component tests + `pnpm audit:viewport` clean
- [ ] 4.4 Save/draft/"Simpan sebagai baru"/owner rules cover summaries; action tests incl. non-owner save rejected (403); verify `pnpm test app/dashboard/tampilan`

## 5. Statistik → Anggota

- [ ] 5.1 "Per tag" card with a visible-tag picker (`?tag=`), invisible ID ignored, out-of-scope `?grup=` still 404; page tests + `pnpm audit:viewport` clean

## 6. Attendance breakdown

- [ ] 6.1 Trim member selects and add breakdown tallies to `activityStatistics` and `activityAttendanceSummary` (tag links loaded once per request); tests: rows add up to totals, cancelled excluded, "Tanpa nilai", invisible tag ignored; verify `pnpm test lib/stats`
- [ ] 6.2 "Rincian menurut" selector + breakdown table (paginated beyond `EMBEDDED_PAGE_SIZE`) on Statistik → Kegiatan and the activity Absensi tab, with the "berdasarkan data anggota saat ini" hint; page tests + `pnpm audit:viewport` clean

## 7. Server-side pagination

- [ ] 7.1 Sortable column lists for participation and per-occurrence tables in `lib/sort.ts`; tests for invalid sort and stable tie-breakers; verify `pnpm test lib/sort`
- [ ] 7.2 Statistik → Partisipasi: search, sort, `?page=` on the server, client table renders one page with links; tests that the response holds only `PAGE_SIZE` rows and page clamping works
- [ ] 7.3 Activity Absensi tab: per-occurrence (`?kejadian=`) and per-member (`?peserta=`) tables paginated and sorted on the server; update `participation-table.layout.test.ts` and attendance-chart tests; `pnpm audit:viewport` clean

## 8. Docs and gate

- [ ] 8.1 Update DESIGN.md §6 (breakdown, DB counting), §7 (Statistik, Absensi tab, tampilan pages), §10 (deferred items from the proposal), §12 (summaries, tag rule), §13 (tag counting); verify the sections match the specs
- [ ] 8.2 Run `pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm audit:viewport` and confirm all pass
