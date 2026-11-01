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
- [x] 3.2 Add tag-key and simple-tag counting (`memberTag.groupBy`, totals − sum) with query tests: bucket sums equal total, deleted value folds into "Tanpa nilai", out-of-scope members never counted; verify `pnpm test lib/summary`
- [x] 3.3 Rewrite `memberStatistics` on the shared counters (no `findMany` of all members) and add the optional tag breakdown; `lib/stats.queries.test.ts` updated and passing

## 4. Summaries in member views

- [x] 4.1 Add `summaries` to `definitionSchema` and lenient parsing (drop invalid entries with a warning); resolve tag anchors per design D2; tests for old definitions without `summaries`, too many summaries, invisible tag; verify `pnpm test lib/validation lib/member-view`
- [x] 4.2 `lib/member-view/summaries.ts`: compute every summary over `prepareView`'s population, paginating bucket tables beyond `SUMMARY_MAX_BARS`; tests for scope, org level above viewer rejected, independence from page/grouping; verify `pnpm test lib/member-view`
- [x] 4.3 "Ringkasan" cards (Recharts bar + numbers + paginated table, `?ringkasan<i>=`) in `view-page.tsx`, and the summary editor in the "Tampilan" menu (add/remove/reorder/dimension, age bucket editor reused); component tests + `pnpm audit:viewport` clean
- [x] 4.3a Mobile/tablet check of summary cards and editor: charts resize at 375/768px (no overflow, labels readable, numbers also shown as text), bucket tables scroll or stack without breaking the page, reorder/remove controls have ≥ 44px targets and work by touch (no hover/drag-only), editor usable with the on-screen keyboard open
- [x] 4.4 Save/draft/"Simpan sebagai baru"/owner rules cover summaries; action tests incl. non-owner save rejected (403); verify `pnpm test app/dashboard/tampilan`

## 5. Statistik → Anggota

- [x] 5.1 "Per tag" card with a visible-tag picker (`?tag=`), invisible ID ignored, out-of-scope `?grup=` still 404; page tests + `pnpm audit:viewport` clean
- [x] 5.2 Mobile/tablet check of "Per tag": picker is a touch-friendly native/sheet control, long key/value names do not overflow, chart and numbers readable at 375/768px

## 6. Attendance breakdown

- [x] 6.1 Trim member selects and add breakdown tallies to `activityStatistics` and `activityAttendanceSummary` (tag links loaded once per request); tests: rows add up to totals, cancelled excluded, "Tanpa nilai", invisible tag ignored; verify `pnpm test lib/stats`
- [x] 6.2 "Rincian menurut" selector + breakdown table (paginated beyond `EMBEDDED_PAGE_SIZE`) on Statistik → Kegiatan and the activity Absensi tab, with the "berdasarkan data anggota saat ini" hint; page tests + `pnpm audit:viewport` clean
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

## 10. Additional tasks found while implementing

- [x] 10.1 Fixed: the tag sheet had no Base UI trigger, so the focus manager guessed the pointer type and forgot it after a short delay; under load a touch open focused the search box. `TagOverlay` now records the pointer type on its own trigger and `initialFocus` reads it (reproduced 4/6 failures under CPU load, 0/14 after; keyboard-open test added)
- [x] 10.2 Org level above the viewer is now rejected on save in `resolveDefinitionSummariesStrict` (done in 4.4); display still shows the "tidak berlaku" card from 4.2 for old saved views
- [x] 10.3 (decided in 4.3: the param keeps indexing the displayed cards; a shifted page after a dropped summary is harmless) Card page param `?ringkasan<i>=` indexes the cards after unusable summaries were dropped, so it can shift against the saved order when a tag summary is dropped; decide in 4.3 whether the param should use the saved index instead
- [ ] 10.4 `pnpm audit:viewport` is clean but never reaches the Ringkasan cards or the menu editor: `/dashboard/tampilan/1` is skipped (HTTP 404, the audit seed has no saved view) and the menu/age-bucket editor is not a click-through flow. Seed a view with summaries (incl. a >12-bucket org level) and add a flow that opens the "Tampilan" menu (covers 8.4)
- [x] 10.5 Summary card chart: label column is fixed at 104px and labels are cut at 16 chars (checked in 4.3a at 375/768/812x375: no overflow; names that share a prefix, e.g. "Kelompok Panjang…", look identical in the chart, so the full-name table under it is the reference; accepted). Found and fixed in 4.3a: the 2-column grid stretched the short card to the tall one, now `items-start`
- [ ] 10.6 Not checkable in the browser pane, left for 8.2 on the iOS Simulator: the Tampilan menu editor with the on-screen keyboard open (age bucket inputs near the bottom of the popover), and real touch on the select/up/down/remove controls. 4.3a verified 44px targets by CSS, the popover fitting 812x375 (scrolls inside), and no hover/drag-only controls
- [x] 10.7 (done in 5.2: `keyTagId` seed id, `?tag=` route and "statistik per tag picker" flow; audit clean) `pnpm audit:viewport` is clean with the "Per tag" card but does not measure it: no route loads `/dashboard/statistik?tab=anggota&tag=<id>` and no flow opens the card's picker popover (seed needs a key with values and a simple tag). Add both (covers 5.2 and 8.4)
- [ ] 10.8 "Per tag" lists every bucket in its table (chart is capped at `SUMMARY_MAX_BARS`); a key with dozens of values makes a long card. Decide whether to page it beyond `EMBEDDED_PAGE_SIZE` (own `?` param) like the Ringkasan cards; the spec only requires the dimension rules
- [x] 10.9 Found and fixed in 5.2 (375px, real browser pane): a long tag key made the picker trigger as wide as its label, pushing the clear (X) button 15px outside the card. The trigger now has `min-w-0` and truncates. Checked at 375/768/812x375 (no overflow, 44px targets, popover inside the viewport, long value names wrap in the table). Not covered by the audit (seed names are short); real touch/keyboard stays in 8.2
- [x] 10.11 Found in 6.2 only in the real server (vitest and `renderToStaticMarkup` passed): `FIXED_BREAKDOWN_OPTIONS` exported from the `"use client"` picker reached the server section as a client reference (`.find is not a function`, page crash). Moved to `components/breakdown/options.ts`. Lesson: constants shared between server and client components never live in a client file; check new server-to-client imports in `pnpm dev:scratch`, not just in tests
- [ ] 10.12 `pnpm audit:viewport` failed once with "Could not sign in as owner (admin)" right after a cold start, then passed unchanged on rerun; look for a missing wait/retry in `scripts/viewport-audit/login.ts` if it recurs
- [ ] 10.13 The audit has routes for `?rincian=sex` / `?rincian=age` but no flow that opens the "Rincian menurut" picker or a tag breakdown (needs `?rincian=tag:<keyTagId>` and a >`EMBEDDED_PAGE_SIZE` row case for the pager); add with 6.3 (covers 8.4)
