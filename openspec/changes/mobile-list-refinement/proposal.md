# Proposal

## Why

On a 375×812 phone the Anggota list shows no member on the first screen (first row at 813px), and Kegiatan and Survei start at 726px and 680px. Filters stack one control per row, stat tiles sit above them, and 35–57% of the text on most measured pages is under 14px. `pnpm audit:viewport` checks only form fields, so none of this is caught.

## What Changes

- Below `lg`, list pages show search plus one "Filter" button with an active-filter count; the other filters, sort, and the column picker move into a bottom panel.
- Kegiatan keeps its date navigator visible, because stepping through weeks is a frequent action.
- Stat tiles become compact on phones and drop their hints.
- Read-only text in the dashboard is at least 14px below `xl`. Print output does not change.
- `pnpm audit:viewport` gains two checks: read-only text size, and how far down the first record starts on list pages.
- `DESIGN.md` §7.1 and §7.2 and the `CLAUDE.md` conventions are updated.

## Capabilities

### New Capabilities
- `mobile-list-layout`: how list pages present filters, summary tiles, and readable text on phones, and how the audit guards it.

### Modified Capabilities
None. List behaviour is specified in the unarchived `list-ux-improvements` change, not under `openspec/specs/`, and URL filter semantics do not change.

## Impact

- `components/filters/filter-bar.tsx`, `components/data-table.tsx`, `app/globals.css`, `app/dashboard/layout.tsx`
- List pages: `anggota`, `kegiatan`, `survei`, `pengguna`, `audit`
- `scripts/viewport-audit/*`
- No schema, server action, permission, or dependency changes.
