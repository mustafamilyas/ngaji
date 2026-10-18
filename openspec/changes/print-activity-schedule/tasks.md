# Tasks

## 1. Pure helpers (TDD)

- [x] 1.1 Add `PRINT_MAX_MONTHS = 3` to `lib/constants.ts`
- [x] 1.2 Add `isWithinMonths(from, to, months)` to `lib/dates.ts` (true when `to` is before `from` + `months` calendar months, clamped to month end). Tests: 2026-01-01..2026-03-31 true, 2026-01-01..2026-04-01 false, 2026-01-31..2026-04-29 true, 2026-01-31..2026-04-30 false, same-day range true
- [x] 1.3 Add `groupScheduleByDate(entries, { showCancelled })` (plus an end-time helper, unless one exists already) in `lib/activity/print.ts`. Tests: grouping by `effectiveDate`, ordering by time then name, moved entry under its effective date, cancelled hidden/shown, a date whose only entry was cancelled is omitted when hidden, empty input

## 2. Print route

- [x] 2.1 Create `app/dashboard/kegiatan/cetak/page.tsx`: auth redirect, filter parsing identical to the list, range cap check before querying, `listActivityOccurrences` with `NotFoundError` → `notFound()`, `batal` parsing
- [x] 2.2 Render the header (organisation name, "Jadwal Kegiatan", group label, `formatDateRange`, print date), the per-date sections with tables (Jam, Kegiatan, Grup, Lokasi, Keterangan + "Dipindah"/"Batal"), the "Tidak ada jadwal" empty state and the over-range message
- [x] 2.3 Add the screen-only toolbar (`print:hidden`): "Kembali" link to `/dashboard/kegiatan` with the same filters, a "Tampilkan yang batal" toggle link, and a client `PrintButton` calling `window.print()`
- [x] 2.4 `app/dashboard/kegiatan/cetak/page.test.ts`: unauthenticated redirect; all entries unpaginated; out-of-scope id dropped; only out-of-scope ids → 404; `batal=0` hides cancelled; default shows cancelled; over-3-month range shows message and does not query

## 3. Print styling and entry point

- [x] 3.1 Add `print:hidden` to the sidebar and top bar in `components/nav-shell.tsx`, and remove shell padding and offsets under print
- [x] 3.2 Add print rules in `app/globals.css`: `@page { size: A4; margin: 15mm }`, force light tokens and `color-scheme: light`, repeat `thead`, `break-inside: avoid` on date sections
- [x] 3.3 Add the "Cetak" action (Printer icon) to the `PageHeader` on `/dashboard/kegiatan`, linking to the print route with the current `grup`, `q`, `range`, `anchor`, `from`, `to`. Extend `app/dashboard/kegiatan/page.test.ts` to assert the href

## 4. Docs and verification

- [x] 4.1 Update DESIGN.md §7: new `/dashboard/kegiatan/cetak` row, and the "Cetak" action on the `/dashboard/kegiatan` row
- [x] 4.2 Verify in the browser preview with print-media emulation: navigation and toolbar hidden, dark theme prints light, moved/cancelled labels shown
- [x] 4.3 `pnpm lint && pnpm tsc --noEmit && pnpm test`
