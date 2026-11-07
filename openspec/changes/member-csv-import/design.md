# Design

## Context

See proposal.md - Why. `createMemberSchema` and `createMember` handle one member, and `ActionResult` returns one error message. `lib/interest/csv.ts` only writes CSV. Server Actions accept 1MB by default and `next.config.ts` does not raise it. Interactive Prisma transactions time out after 5 seconds by default. `Group.name` is unique only among siblings.

## Goals / Non-Goals

**Goals:** a safe bulk path for clean spreadsheets, with no schema change.

**Non-Goals:** `.xlsx` upload; group paths in the `grup` column; updating existing members; importing tags; bulk undo; member CSV export; relaxing required fields.

## Decisions

### 1. Stateless preview and confirm
Two Server Actions take the file and group id as `FormData`:
- `previewMemberImportAction` returns counts, errors, and ignored columns.
- `confirmMemberImportAction` runs the same pipeline, then writes.

The client keeps the `File` in state between them. A staging table was rejected, because it would store PII for abandoned imports and need cleanup. Confirm has to re-validate anyway, so re-sending the file costs little.

### 2. A pure pipeline in `lib/member/import/`
- `decode.ts`: strip BOM; try strict UTF-8, then fall back to Windows-1252.
- `parse.ts`: choose the separator by counting `;` and `,` in the header line, then parse with `papaparse`. It rejects broken quotes, because an unclosed quote can merge the rest of the file into one cell, and enforces `MAX_IMPORT_ROWS` before any row is validated.
- `columns.ts`: one column list, used by the header matcher, template, and help text. A column that appears twice fails the file, because either copy could be the right one.
- `rows.ts`: convert cells, then run `createMemberSchema`, so zod rules stay defined once.
- `duplicates.ts`: normalize keys and compare.

Everything except the duplicate query is pure and written test-first. `papaparse` was chosen over a hand-written parser because quoted fields with embedded newlines are easy to get wrong.

### 3. Limits under the framework's cap
`MAX_IMPORT_FILE_BYTES = 900_000` and `MAX_IMPORT_ROWS = 2000` go in `lib/constants.ts`, with `MAX_IMPORT_ERRORS_SHOWN = 100`. The client checks size first, because a body over 1MB fails in the framework before our error handling. The server checks again. The body limit stays at its default.

### 4. Write path
`importMembers(session, rows)` in `lib/member/mutations.ts`, where each row carries its `groupId`, reuses `resolveGroup`, `authorize(session, "member.create", …)`, and `assertLeafGroup` once per distinct group. It uses one `db.$transaction` with an explicit `timeout`, calling `tx.member.create` and `audit(tx, …)` per row.

`createManyAndReturn` was rejected for now because `audit()` writes one row at a time, and the per-row path keeps redaction in one place. Measure 2000 rows; if it takes more than a few seconds, batch while still going through the redaction.

### 5. Audit per member, tied by `importId`
Per-member entries keep each member's history the same as a manual add. This differs from bulk tagging's single entry, because `member.create` carries a full snapshot. `meta.importId` is a UUID, which also makes a later manual cleanup possible.

### 6. Duplicate lookup
One query for non-deleted members with `group.path startsWith session.groupPath` and `birthDate in (…)`, selecting only `name` and `birthDate`; names are then compared in memory. The query is scoped, so a match cannot reveal anyone outside the user's scope. The preview marks rows by number and does not show details of the existing member.

### 7. Entry point
"Impor CSV" sits in a ⋮ menu beside "Tambah anggota", reusing `RowActions`, so the phone header gains no full-width button.

### 8. Optional `grup` column
A higher-level user can load several leaf groups from one file. When the file has a `grup` column, it replaces the chooser and every row must fill it; a blank cell is a row error, so no member lands in a group by accident. Without the column, the chooser is required.

A cell holds the leaf group's name, matched with the same normalization as duplicate keys against non-deleted leaf groups in the user's scope. One query loads those groups, then rows resolve in memory. `Group.name` is unique only among siblings, so a name matching several leaf groups is a row error, and those members go through a separate upload with the chooser. Paths were rejected to keep the column simple. A name outside the scope reports the same error as an unknown name, so the import cannot reveal that a group exists.

### 9. Template
A session-protected route handler, `/dashboard/anggota/impor/template`, generates the header row from `columns.ts`, so it cannot drift. It uses `,` and a BOM. It holds no example row, so a fictional member cannot be imported by accident.

## Risks / Trade-offs

- [Real spreadsheets lack required fields such as `tempat_lahir`, so files are rejected] → per-row errors make the gap clear. Relaxing the schema is a separate decision.
- [Leaf names repeat across desa, so a `grup` value can be ambiguous] → the row reports it, and those members use a separate upload with the chooser. Accepting paths can be added later without changing this flow.
- [`D/M/YYYY` is misread if a file is month-first] → Indonesian files are day-first; impossible dates are rejected, but ambiguous ones are not detectable. The help text says so.
- [A long transaction blocks other SQLite writers] → the row cap and the measurement in decision 4.
- [No bulk undo] → the preview, all-or-nothing, and duplicate skipping; `importId` allows a manual fix.
- [Audit log grows by up to 2000 entries per import] → accepted; the viewer is paginated.

## Migration Plan

No schema migration. The `papaparse` dependency reaches production with the normal install step, and the release needs a document in `docs/releases/`. Roll back by reverting; imported members stay and remain valid.

## Open Questions

- Does the comma template open in columns on Excel with an Indonesian locale? If not, switch the template to `;`. The parser accepts both, so specs and tasks do not change.
