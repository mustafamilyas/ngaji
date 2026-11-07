# Tasks

## 1. Parsing

- [x] 1.1 Add `papaparse` and its types, and add the import limits to `lib/constants.ts`; verify `pnpm tsc --noEmit` passes
- [x] 1.2 Write tests, then implement `decode.ts` for BOM, UTF-8, and Windows-1252; verify they pass
- [x] 1.3 Write tests, then implement `parse.ts` for both separators, quoted newlines, skipped empty rows, broken quotes, and `MAX_IMPORT_ROWS`; verify they pass
- [x] 1.4 Write tests, then implement `columns.ts` header matching for variants, missing required columns, repeated columns, ignored columns, and optional `grup`; verify they pass
- [x] 1.5 Failure found in 1.2: Node 24's `TextDecoder("windows-1252")` decodes bytes 0x80–0x9F as control characters, corrupting `“ ” – €`. Map that range in `decode.ts`; verify the Windows-1252 punctuation test passes
- [x] 1.6 Failure found in 1.3: a file with bare CR line endings had no header line to count, so a `;` file with commas in its cells chose `,`. Split the header line on CR too; verify by test

## 2. Row rules

- [x] 2.1 Write tests, then implement date conversion, covering day-first dates, impossible dates, two-digit years, and serial numbers; verify they pass
- [x] 2.2 Write tests, then implement `rows.ts` for enum labels, defaults by organization time zone, exit date, and scientific-notation phones, using `createMemberSchema`; verify they pass
- [x] 2.3 Write tests, then implement duplicate key normalization and in-file matching; verify they pass
- [x] 2.4 Write tests, then implement `grup` cell resolution against a list of leaf groups, covering a unique match, blank cell, unknown name, and ambiguous name; verify they pass

## 3. Server

- [x] 3.1 Implement the scoped duplicate query; verify by test that out-of-scope and soft-deleted members never match
- [x] 3.2 Implement `importMembers` with per-row groups, one transaction, per-member audit, and a shared `importId`; verify by test that a mid-way failure leaves no members or audit entries
- [x] 3.3 Measure a 2000-row import against SQLite, set the transaction timeout, and record the result in design.md
- [x] 3.4 Implement the preview and confirm actions; verify cross-scope, cross-organization, non-leaf, and unauthenticated cases by test
- [ ] 3.5 Verify by test that confirm re-validates and rejects a file with one bad row, and that logs contain no cell values
- [ ] 3.6 Implement the scoped leaf-group lookup for `grup`; verify by test that out-of-scope, other-organization, soft-deleted, and non-leaf names all report the unknown-group error, and that a file with neither `grup` nor a chosen group is rejected
- [x] 3.7 Failure found in 3.3: the non-leaf `importMembers` test counted members named `Cabang …`, but `survey/entry.test.ts` creates "Cabang Lain" in the same shared test database, so it failed on some full runs. Prefix every `importMembers` test name with `Imptest`; verify by repeated runs
- [x] 3.8 Failure found in 3.4: the action tests counted members by name prefix, but `member-view/results.test.ts` creates "Ulang Tahun Hari Ini" in the shared test database, so "Ulang " miscounted on some full runs. Scope the counts to the test's own organizations; verify by repeated full runs

## 4. UI

- [ ] 4.1 Add the template route handler; verify it requires a session and that its header matches `columns.ts`
- [ ] 4.2 Build `/dashboard/anggota/impor` with the group chooser, column help, upload, preview, "Tetap impor", and result; verify the flow with a jsdom form test
- [ ] 4.3 Add the "Impor CSV" menu entry on the Anggota page; verify it appears at 375px and 1280px
- [ ] 4.4 Add the page to `pnpm audit:viewport`; verify it exits 0
- [ ] 4.5 Run a full import in the browser on `pnpm dev:scratch` with a file saved from Excel; verify the members, audit entries, and a second upload marked as duplicates

## 5. Docs and final checks

- [ ] 5.1 Update `DESIGN.md` §2, §4.4, and §7 in the same commit as the behaviour; verify they name the page, the limits, and `meta.importId`
- [ ] 5.2 Run `pnpm lint`, `pnpm tsc --noEmit`, and `pnpm test`; verify all pass
