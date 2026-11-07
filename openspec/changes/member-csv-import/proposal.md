# Proposal

## Why

Members can only be added one at a time, which makes moving an existing spreadsheet into Dahan impractical. Onboarding an organization needs a bulk path that keeps the same scope, validation, and audit guarantees as the single-member form.

## What Changes

- New page `/dashboard/anggota/impor`: pick one leaf group or name each row's group in an optional `grup` column, download a template, upload a CSV, review a preview, then confirm.
- The preview lists errors per row and marks likely duplicates. Nothing is stored until the user confirms.
- All-or-nothing: any invalid row blocks the whole import.
- Duplicates (same name and birth date within the user's scope) are skipped unless the user ticks "Tetap impor".
- Any role may import into a leaf group in its scope, the same rule as adding one member (DESIGN.md §1, §3).
- Each imported member gets its own `member.create` audit entry, in the same transaction.
- The parser accepts common Excel output: `;` or `,` separators, BOM, Windows-1252, day-first dates, and Indonesian labels.
- The Anggota page header gains an "Impor CSV" entry in a menu.

## Capabilities

### New Capabilities
- `member-csv-import`: bulk creation of members from a CSV file, including template, preview, duplicates, limits, and audit.

### Modified Capabilities
None. Member behaviour is specified in unarchived changes, not under `openspec/specs/`, and the single-member flows do not change.

## Impact

- New: `app/dashboard/anggota/impor/*`, `lib/member/import/*`
- Changed: `lib/member/mutations.ts`, `lib/constants.ts`, `app/dashboard/anggota/page.tsx`, `scripts/viewport-audit/*`
- New dependency: `papaparse`
- `DESIGN.md` §2, §4.4, and §7 are updated
- No schema migration
