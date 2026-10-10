# Tasks

## 1. Layout
- [x] 1.1 Fixed-height frame; only `<main>` scrolls; scroll-padding so navigation lands at the top
- [x] 1.2 Collapsible desktop sidebar (icon rail, Ctrl/⌘+B), state in a cookie read server-side
- [x] 1.3 Mobile overlay drawer (closes on navigate, backdrop, Escape)

## 2. Standard filter
- [x] 2.1 `lib/filters.ts` parsers + date range model + label formatting (tests first)
- [x] 2.2 `FilterBar`, `SearchFilter`, `SelectFilter`, `GroupFilter`, `DateRangeFilter`
- [x] 2.3 Multi-group `listMembers` / `listUsers` / `listAuditLog` via `resolveGroups`; activity-name search after conflict detection (tests)
- [x] 2.4 Wire into `/anggota`, `/kegiatan`, `/kegiatan/[id]`, `/statistik`, `/pengguna`, `/audit`; remove old filter form and group picker

## 3. Pagination
- [x] 3.1 `lib/pagination.ts` (clamp, in-memory slice, page window, href) with tests
- [x] 3.2 Shared `Pagination` (links or buttons; hidden for one page)
- [x] 3.3 Server lists: `/anggota`, `/audit`, `/pengguna`, member history, `/grup/[id]` (4 lists), `/kegiatan`, activity schedule
- [x] 3.4 Client tables: participation, per-occurrence

## 4. Member table
- [x] 4.1 `lib/member/columns.ts` + `lib/member/whatsapp.ts` with tests
- [x] 4.2 Server-rendered `MembersTable`, `ColumnToggle` + cookie Server Action
- [x] 4.3 WhatsApp button on table and member detail

## 5. Docs
- [x] 5.1 DESIGN.md §4.5, §6, §7, §7.1 and these spec deltas
- [ ] 5.2 `pnpm test` green after step 4 (step 3 run: 454/454; step 4 suite not yet run). `pnpm lint` is broken on `main` by the pre-existing eslint-plugin-react / ESLint 10 incompatibility

## 6. Page layout
- [x] 6.1 `PageHeader` (breadcrumb, badges, meta, actions), `TabNav` + `lib/tabs.ts` (tests), `DangerZone`, `groupTrail`
- [x] 6.2 Detail pages: `/grup/[id]`, `/anggota/[id]`, `/kegiatan/[id]`, `/kegiatan/[id]/[tanggal]`, plus `/anggota/baru` (`?grup=` preselect), `/kegiatan/baru`, `/kegiatan/[id]/geser`
- [x] 6.3 Sub-group add and single-occurrence override move into dialogs
- [x] 6.4 `/statistik` (shared tabs, filters kept across tabs), `/pengguna` (create + per-user "Kelola" dialogs, `lib/user/row-permissions.ts` with tests), `/pengaturan/jenjang`
- [ ] 6.5 `pnpm test` green (page tests updated for tabs; not yet run)

## 7. List tables
- [x] 7.1 `lib/sort.ts` (parse, href, preserve, comparator) and `lib/activity/list-sort.ts`, with tests
- [x] 7.2 `TableCard`, `SortableTh`, `StatTiles`, `RowActions` (kebab of links) and `ui/dropdown-menu`
- [x] 7.3 Whitelisted `orderBy` in `listMembers`, `listUsers`, `listAuditLog`, with id/name tie-breakers
- [x] 7.4 `/anggota`, `/pengguna`, `/kegiatan` (list view), `/audit` as sortable table cards; `/grup` tree card; participation table uses the shared sort icon
- [ ] 7.5 `pnpm test` green (member sort page test added; not yet run)
