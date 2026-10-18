# Proposal

## Why

Group admins hand out the week's or month's schedule on paper (notice boards, WhatsApp photos, members without accounts). `/dashboard/kegiatan` (DESIGN.md §7) is built for managing activities on screen: it is paginated at 50 rows, it is wrapped in the app shell, and it shows management badges. Printing it from the browser gives a broken, incomplete page. We want a clean, printable schedule. No server-side PDF; the browser's own print dialog (including "Save as PDF") is enough.

## What Changes

- A new route `/dashboard/kegiatan/cetak` renders the occurrences for the same filters as the activity list (`grup`, `q`, `range`, `anchor`, `from`, `to`). It reuses `listActivityOccurrences`, so the scope and union rules of §5.3 are unchanged.
- Layout: a header (title, group label, date range, print date), then one section per date that has at least one occurrence. Each section has a table of time range, activity, group, location and notes. Entries are always sorted by date then start time, with no pagination. "Dipindah" and "Batal" appear as plain-text labels. Conflict and inherited badges, stat tiles and row actions are left out.
- A "Tampilkan yang batal" toggle in the URL (`batal=0|1`) shows or hides cancelled occurrences. Default is **shown**.
- The range is capped at **3 months** (`PRINT_MAX_MONTHS` in `lib/constants.ts`). A longer custom range shows a message and nothing to print, instead of a partial result.
- A screen-only toolbar ("Kembali" link back to the list with the same filters, the cancelled toggle, and a "Cetak" button that calls `window.print()`) is hidden when printing. So is the dashboard navigation shell.
- `/dashboard/kegiatan` gets a "Cetak" button that opens the print route with the current filters.

## Capabilities

### New Capabilities
- `activity-schedule-print`: printable schedule page for the activity list. Covers filter parity with the list, scope enforcement, grouping and ordering by date, the cancelled toggle, the 3-month cap, and what is hidden on paper.

### Modified Capabilities
<!-- none: the list page only gains a link; listing/scope requirements are unchanged -->

## Impact

- New: `app/dashboard/kegiatan/cetak/page.tsx` (Server Component), a small client `PrintButton`, and a pure grouping helper in `lib/activity/`.
- Changed: `app/dashboard/kegiatan/page.tsx` (header action), `components/nav-shell.tsx` (`print:hidden` on the navigation), `app/globals.css` (`@page` and print rules), `lib/constants.ts` (`PRINT_MAX_MONTHS`).
- No Prisma, authz or server action changes. The page is read-only, so no `AuditLog` entry is written.
- DESIGN.md §7: a new row for `/dashboard/kegiatan/cetak` and a mention of the "Cetak" action on the `/dashboard/kegiatan` row.
