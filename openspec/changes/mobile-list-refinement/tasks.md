# Tasks

## 1. Text size

- [x] 1.1 Add `data-dashboard` to the dashboard layout and the `--text-xs` override in `app/globals.css`; verify in the browser that card labels and a portaled popup are 14px at 375px, and 12px at 1280px
- [x] 1.2 If the override does not apply, switch to the `text-label` fallback from design.md and verify the same checks (not needed: the override applied, including portaled popovers)
- [x] 1.3 Run `pnpm audit:print` and verify it exits 0

## 2. Filter panel

- [x] 2.1 Write jsdom tests for the panel: count display, Escape and backdrop close, focus return, and no button without `more`
- [x] 2.2 Add `more` and `activeCount` to `FilterBar`, with the panel below `lg` and `lg:contents` above; verify the tests pass
- [x] 2.3 Verify in the browser that changing a filter in the panel updates the URL, drops `page`, and keeps the panel open, and that Group, Tag, and date popovers open above the panel
- [x] 2.4 Move Anggota's secondary controls, including `ColumnToggle`, into `more`; verify there is no nesting warning and that picking a column does not submit the filter form
- [x] 2.5 Move secondary controls on Survei, Pengguna, and Audit into `more`, and on Kegiatan keep the date navigator inline; verify `page.layout.test.ts` files pass after updating them

## 3. Stat tiles

- [x] 3.1 Make `StatTile` compact below `lg` and hide hints; verify at 375px and that the 1280px layout is unchanged

## 4. Audit

- [x] 4.1 Add `read-text-size` to the collector and findings, with `data-small-text-ok` exemption; verify with cases in `findings.test.ts`
- [x] 4.2 Add `first-record` for the five list pages at phone size; verify with cases in `findings.test.ts`
- [x] 4.3 Run `pnpm audit:viewport`, fix or mark each finding, and verify it exits 0

## 5. Docs and final checks

- [x] 5.1 Update `DESIGN.md` §7.1 and §7.2 and the `CLAUDE.md` conventions in the same commit as the behaviour; verify they name the panel, the 14px rule, and the exemption attribute (landed as a separate docs commit, because slices 1–4 were committed one at a time for review)
- [x] 5.2 Run `pnpm lint`, `pnpm tsc --noEmit`, and `pnpm test`; verify all pass
- [x] 5.3 Capture before and after screenshots of the five list pages at 375×812 and verify each first record is at or above 600px (before → after: Anggota 813 → 545, Kegiatan 726 → 582, Survei 680 → 500, Pengguna 451 → 347, Audit 499 → 291)

## 6. Follow-ups requested during member-csv-import review

- [ ] 6.1 Add a "Terapkan" button to the Tampilan page, so edits to a view's rules apply only when it is pressed instead of changing the view unpredictably while editing; verify by jsdom test that the result does not change before "Terapkan" and does after
- [ ] 6.2 Let ADMIN/OWNER open the check-in page (`/dashboard/kegiatan/[id]/[tanggal]/absen`) for future dates, which today says "Tanggal ini belum terjadi; absensi belum bisa diisi"; USER stays at today or earlier. Update DESIGN.md §1 and §3.3 rule 4 and the CLAUDE.md invariant in the same commit; verify by test for ADMIN, OWNER, and USER
- [ ] 6.3 Show the "Isi absensi" button on the activity page to ADMIN/OWNER on every day, not only when an occurrence falls today. Decide with the owner which occurrence it opens when there is none today, then verify by test

## 7. Failures found during implementation

- [ ] 7.1 `pnpm audit:print` (and `pnpm audit:viewport`, same `startScratchEnv`) exits 1 with "next dev exited early" while any other `next dev` runs in this folder, including `pnpm dev:scratch` on port 3100; decide with the owner whether to support running alongside a dev server (e.g. a separate `distDir`) or keep the documented limitation
- [x] 7.2 The filter panel closes after every filter change on Anggota: `MemberTagProviders` keys `BulkSelectionProvider` by the visible member ids (`components/tags/member-tag-providers.tsx:23`), so the whole table card, `FilterBar` included, remounts when the list changes. Keep the panel open (spec: "the panel stays open") without losing the bulk-selection reset; verify in the browser
- [x] 7.3 Picking a column in `ColumnToggle` inside the panel navigates the filter form and drops `page`: its form is portaled in the DOM, but React's synthetic `submit` bubbles through the React tree into next/form's `onSubmit`. Stop the event at the column form without blocking its server action; verify by jsdom test and in the browser
- [x] 7.4 Below `sm`, the search field is `w-full`, so the "Filter" button wraps to its own row; spec says they share one row at 375px. Fix in `SearchFilter`, checking that detail tabs and Statistik, which keep their layout, are not affected
- [x] 7.5 `read-text-size` reports Recharts' hidden `#recharts_measurement_span` (at `top: -20000px`) on every chart page, 57 false findings: the collector skips only content off-screen horizontally. Also skip text above the document top
- [x] 7.6 The "member tag filter" and "activity tag filter" audit flows fail with "nothing to click": the tag filter is in the closed filter panel at every scenario size. Open the panel first (this also audits the open panel)
- [x] 7.7 The weekday label in the Jadwal tab's date badge (`app/dashboard/kegiatan/[id]/page.tsx`, `text-[0.65rem]`) is 10.4px below xl
- [x] 7.8 Kegiatan's first record starts at 634px at 360×740 (limit 600): the date navigator fills row two, so the "Filter" button wraps to a third row
- [x] 7.9 The audit still measures Kegiatan's first record at 634px, while a phone-size browser shows 582px: the audit emulates with `mobile: false`, so headless Chrome reserves a ~15px classic scrollbar, and search (min 12rem) + Filter (84px) no longer fit the 281px row. Decide whether to narrow the search minimum or emulate overlay scrollbars
- [x] 7.10 The month calendar on Kegiatan (`app/dashboard/kegiatan/activity-calendar.tsx`) shows activity names at 10px and notes at 9px from `sm` to below `xl`, and the audit misses it: it visits `?view=calendar` only with the default range, which renders no month grid. Add the month view to the audit page list and fix or mark the cell text
