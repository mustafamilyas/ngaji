# Proposal

## Why

Lists grew past what the MVP screens handle well: a long page stretched the whole frame so the sidebar scrolled away; every list page had its own ad-hoc filter form (flat single-group selects, raw date inputs, no search on some pages); only `/anggota` and `/audit` paginated; and the member list showed just name, group and status, with no quick way to contact a member.

## What Changes

- **Layout**: fixed-height app frame where only the content scrolls; collapsible desktop sidebar (icon rail, Ctrl/⌘+B, remembered in a cookie); mobile menu as an overlay drawer.
- **Standard filter bar** on every list page: name search, a searchable tree group picker (multi-select; single-select on `/statistik`), and a date range control with presets, custom from/to and prev/next — only where the page has a natural date. Filter state stays in the URL; empty fields are omitted and any change resets to page 1.
- **Pagination everywhere it fits**, through one shared pager; out-of-range pages clamp to the last page. Embedded lists on detail pages use a smaller page size and their own page params.
- **Member table** with selectable columns (sex, birth date + age, status, group path, phone, address, …), stored per browser in an httpOnly cookie and rendered server-side so hidden PII is never sent.
- **WhatsApp button** on the member table and member detail page (`wa.me` link from a normalized phone number).

## Capabilities

### New Capabilities
- `list-views`: shared layout, filter, pagination, member-column and WhatsApp conventions for list pages.

### Modified Capabilities
- `member-management`: list becomes multi-group and gains columns + WhatsApp.
- `audit-log`: viewer gains a group filter and date presets.
- `statistics`: 30-day default is inclusive; single scope group; participation search + pagination.
- `user-management`: `/pengguna` gains search, group filter and pagination.
- `activity-calendar-view`: name search; date control shared with other pages (custom ranges can also be stepped).

## Impact

- New: `lib/filters.ts`, `lib/pagination.ts`, `lib/member/columns.ts`, `lib/member/whatsapp.ts` (all pure, tested); `components/filters/*`, `components/pagination.tsx`, `components/column-toggle.tsx`, `components/whatsapp-button.tsx`, `components/ui/popover.tsx`.
- Queries: `listMembers` / `listUsers` / `listAuditLog` take `groupIds[]` (each resolved via new `resolveGroups`, out of scope → 404) and clamp the page; `listActivityOccurrences` takes `search`; member attendance history is paginated.
- No Prisma schema changes, no changes to `authorize()` or the permission matrix. No new audit actions (column choice is a UI preference cookie).
- DESIGN.md §4.5, §6, §7 and new §7.1.
