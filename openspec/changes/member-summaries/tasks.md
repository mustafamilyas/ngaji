# Tasks

## 1. Dimensions (pure, tests first)

- [x] 1.1 Add `VIEW_MAX_SUMMARIES` and `SUMMARY_MAX_BARS` to `lib/constants.ts`; verify `pnpm tsc --noEmit` passes
- [x] 1.2 Write `lib/validation/summary.ts` (dimension + summary zod schemas, sharing age-bucket and group-level sub-schemas with `member-view.ts`) with tests for valid kinds, overlapping buckets, unknown kind, extra keys; verify `pnpm test lib/validation`
- [x] 1.3 Write `lib/summary/dimensions.ts` (bucket list/labels, `bucketOf(member, today, tagLinks)`, `bucketWheres(dimension, today)`) test-first, covering enum order, "Lainnya", 29 Feb birthdays, "Tanpa nilai", simple tag; verify `pnpm test lib/summary`
- [x] 1.4 Parse `?rincian=` and single `?tag=` with an allow-list in `lib/filters.ts` with tests for invalid values; verify `pnpm test lib/filters`

## 2. Tag rule in member views

- [x] 2.1 Add `tag` field (`hasAnyOf`/`hasNoneOf`, not sortable/groupable) to `lib/member-view/fields.ts` and the rule value parser; tests for operator/value validation; verify `pnpm test lib/member-view/fields lib/validation`
- [x] 2.2 Translate tag rules in `lib/member-view/query.ts`, restricted to visible tag IDs; tests incl. "has none of" matching untagged members; verify `pnpm test lib/member-view/query`
- [x] 2.3 Resolve tag IDs on save (reject unknown/deleted/other org/invisible) and on load (drop + notice) next to group-ID resolution; server-action tests for sibling, other-org, deleted, inherited and descendant tags; verify `pnpm test app/dashboard/tampilan lib/member-view`
- [x] 2.4 Tag picker in the rule editor (`rule-editor.tsx`) using visible tags; verify in `pnpm dev:scratch` and a `*.test.tsx`
- [x] 2.5 Mobile/tablet check of the tag picker in the rule editor: at 375px and 768px it fits without horizontal scroll, touch targets ≥ 44px, long tag names wrap/truncate, picker opens above the on-screen keyboard; `pnpm audit:viewport` clean

## 3. DB-side counting

- [x] 3.1 Extract property / age-bucket / group-level counting from `lib/member-view/sections.ts` into `lib/summary/count.ts`; existing `sections.test.ts` still passes unchanged
- [ ] 3.2 Add tag-key and simple-tag counting (`memberTag.groupBy`, totals − sum) with query tests: bucket sums equal total, deleted value folds into "Tanpa nilai", out-of-scope members never counted; verify `pnpm test lib/summary`
- [ ] 3.3 Rewrite `memberStatistics` on the shared counters (no `findMany` of all members) and add the optional tag breakdown; `lib/stats.queries.test.ts` updated and passing

## 4. Summaries in member views

- [ ] 4.1 Add `summaries` to `definitionSchema` and lenient parsing (drop invalid entries with a warning); resolve tag anchors per design D2; tests for old definitions without `summaries`, too many summaries, invisible tag; verify `pnpm test lib/validation lib/member-view`
- [ ] 4.2 `lib/member-view/summaries.ts`: compute every summary over `prepareView`'s population, paginating bucket tables beyond `SUMMARY_MAX_BARS`; tests for scope, org level above viewer rejected, independence from page/grouping; verify `pnpm test lib/member-view`
- [ ] 4.3 "Ringkasan" cards (Recharts bar + numbers + paginated table, `?ringkasan<i>=`) in `view-page.tsx`, and the summary editor in the "Tampilan" menu (add/remove/reorder/dimension, age bucket editor reused); component tests + `pnpm audit:viewport` clean
- [ ] 4.3a Mobile/tablet check of summary cards and editor: charts resize at 375/768px (no overflow, labels readable, numbers also shown as text), bucket tables scroll or stack without breaking the page, reorder/remove controls have ≥ 44px targets and work by touch (no hover/drag-only), editor usable with the on-screen keyboard open
- [ ] 4.4 Save/draft/"Simpan sebagai baru"/owner rules cover summaries; action tests incl. non-owner save rejected (403); verify `pnpm test app/dashboard/tampilan`

## 5. Statistik → Anggota

- [ ] 5.1 "Per tag" card with a visible-tag picker (`?tag=`), invisible ID ignored, out-of-scope `?grup=` still 404; page tests + `pnpm audit:viewport` clean
- [ ] 5.2 Mobile/tablet check of "Per tag": picker is a touch-friendly native/sheet control, long key/value names do not overflow, chart and numbers readable at 375/768px

## 6. Attendance breakdown

- [ ] 6.1 Trim member selects and add breakdown tallies to `activityStatistics` and `activityAttendanceSummary` (tag links loaded once per request); tests: rows add up to totals, cancelled excluded, "Tanpa nilai", invisible tag ignored; verify `pnpm test lib/stats`
- [ ] 6.2 "Rincian menurut" selector + breakdown table (paginated beyond `EMBEDDED_PAGE_SIZE`) on Statistik → Kegiatan and the activity Absensi tab, with the "berdasarkan data anggota saat ini" hint; page tests + `pnpm audit:viewport` clean
- [ ] 6.3 Mobile/tablet check of the breakdown: "Rincian menurut" selector ≥ 44px and reachable one-handed, wide breakdown table (expected/hadir/izin/tidak hadir/%) stays readable at 375px (scroll with sticky first column or stacked rows), pagination links are touch-sized

## 7. Server-side pagination

- [ ] 7.1 Sortable column lists for participation and per-occurrence tables in `lib/sort.ts`; tests for invalid sort and stable tie-breakers; verify `pnpm test lib/sort`
- [ ] 7.2 Statistik → Partisipasi: search, sort, `?page=` on the server, client table renders one page with links; tests that the response holds only `PAGE_SIZE` rows and page clamping works
- [ ] 7.3 Activity Absensi tab: per-occurrence (`?kejadian=`) and per-member (`?peserta=`) tables paginated and sorted on the server; update `participation-table.layout.test.ts` and attendance-chart tests; `pnpm audit:viewport` clean
- [ ] 7.4 Mobile/tablet check of the server-paginated tables: search/sort controls and column headers are touch-friendly, page links ≥ 44px, sort/page changes keep scroll position and other list params, tables readable at 375/768px

## 8. Mobile and tablet pass (final)

- [ ] 8.1 Walk every touched page (Tampilan with Ringkasan, Statistik → Anggota/Kegiatan/Partisipasi, activity Absensi tab) at 375×812, 768×1024 and landscape phone; fix horizontal scroll, clipped charts, tiny targets, sticky/overlap issues; record findings as extra tasks below
- [ ] 8.2 Verify with real touch input on the iOS Simulator (selectors, pickers, sheets, on-screen keyboard, pull/scroll in tables); record failures as extra tasks below
- [ ] 8.3 `pnpm audit:viewport` and `pnpm audit:print` clean (print of activity schedule unaffected)
- [ ] 8.4 Extend `pnpm audit:viewport` routes to cover the new pages/cards if not already covered

## 9. Docs and gate

- [ ] 9.1 Update DESIGN.md §6 (breakdown, DB counting), §7 (Statistik, Absensi tab, tampilan pages), §10 (deferred items from the proposal), §12 (summaries, tag rule), §13 (tag counting); verify the sections match the specs
- [ ] 9.2 Run `pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm audit:viewport` and confirm all pass
