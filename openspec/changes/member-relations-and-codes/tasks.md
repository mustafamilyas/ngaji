# Tasks

## 1. Schema & migration

- [x] 1.1 Add `Organization.memberCodePrefix String? @unique`, `Member.code String? @unique` and the `MemberRelation` model (design §1, §4); `pnpm prisma migrate dev` succeeds on a seeded dev DB with existing rows
- [x] 1.2 Add `RELATION_TYPES`/`RelationType` to `lib/validation/enums.ts` and `RELATION_MAX_PER_MEMBER`, `RELATION_PICKER_LIMIT`, `MEMBER_CODE_LENGTH`, `MEMBER_CODE_MAX_ATTEMPTS` to `lib/constants.ts`; `pnpm tsc --noEmit` passes

## 2. Pure logic (tests first)

- [x] 2.1 `lib/member/code.ts`: `generateMemberCode(prefix, random)` and `normalizeMemberCode(input)` with tests for shape, alphabet, lowercase, missing dash, `O/I/L` mapping, invalid input → `null`
- [x] 2.2 Prefix validation in zod (`^[A-Z]{2,4}$`) with tests for valid, digits, too long, lowercase
- [x] 2.3 `lib/member/relations.ts`: `canonicalPair(type, a, b)` and `relationLabel(type, side, relativeSex)`, plus section ordering, with tests covering every row of the spec's type table

## 3. Member code assignment

- [x] 3.1 `createMember` assigns a code with collision retry; the client `code` is ignored; an org without a prefix gives a generic error; tests in `lib/member/mutations.test.ts` (shape, collision retry via forced duplicate, ignored client value, unchanged on update, snapshot contains code)
- [x] 3.2 CSV import assigns distinct codes within its transaction and ignores a `kode` column; import action test with 40 rows
- [x] 3.3 `provisionOrganization` + `from-env.ts` accept `BOOTSTRAP_MEMBER_CODE_PREFIX`; invalid or duplicate prefix fails atomically; provision tests
- [x] 3.4 `scripts/member-codes-backfill.ts` + `pnpm member-codes:backfill` (args `orgId=PREFIX`, refuses partial coverage, batches, `member.code_backfill` audit, idempotent); test on a temp DB: run twice, second run changes nothing
- [x] 3.5 Seed sets prefixes for both orgs and codes for all members; `pnpm prisma db seed` then no `code IS NULL` rows

## 4. Relationships server side

- [x] 4.1 `member.relate` in `lib/authz.ts` (both members non-deleted and in scope) with authz tests including the denied cases from the spec
- [x] 4.2 `linkMembers` / `unlinkMembers` server actions: resolve both ids, validate pair rules (self, deleted, existing relation in either direction, max per member), transaction + `member.relate`/`member.unrelate` audit; cross-scope and cross-org tests return 404 and write nothing
- [x] 4.3 `getMemberRelatives(session, memberId)` query: hides soft-deleted relatives, strips `id` and extra fields for out-of-scope relatives; test asserts no phone, address or birth date in the payload
- [x] 4.4 `searchRelativeCandidates`: scope-filtered, excludes self, limit, matches name or normalized code; tests for out-of-scope name and code

## 5. Search & column

- [x] 5.1 Member list search adds `OR code = normalizeMemberCode(q)` within scope; `lib/member/queries.test.ts` covers the spec scenarios
- [x] 5.2 Add the `kode` column ("Kode", hidden by default) to `lib/member/columns.ts` and render it in the member table and member views; column tests updated

## 6. UI

- [x] 6.1 Member detail header shows the code (copyable); page test checks it renders
- [x] 6.2 Keluarga section + "Tambah keluarga" dialog (type/direction in plain words, member picker) + remove with confirmation, using `useKeepValues` for the form; DOM tests for in-scope link vs out-of-scope plain text and the empty state
- [x] 6.3 Seed adds a few sample relationships (via the 4.2 link logic); `pnpm audit:viewport` covers the member detail page with relatives and the open dialog; exit 0

## 7. Docs & verification

- [x] 7.1 DESIGN.md: §2 model + notes, §3.2 matrix row, §4.5 audit actions, §7 member detail page, new §14 Relasi & kode anggota (incl. "code is not an authenticator"), §10 relations row removed; DEPLOYMENT.md backfill step
- [x] 7.2 `pnpm lint && pnpm tsc --noEmit && pnpm test` all pass; manual check on `pnpm dev:scratch`: link a parent across two kelompok as desa admin, view as kelompok USER, search by code

## 8. Failures found during implementation

- [x] 8.1 `app/dashboard/anggota/impor/actions.test.ts` (3 tests) fails after 3.1: `buildPageFixture` in `lib/test/fixtures.ts` creates organizations without `memberCodePrefix`, so import now throws "no member code prefix". Give fixture organizations a unique prefix derived from the organization id
- [x] 8.2 `buildPageFixture` in `lib/test/fixtures.ts` creates its base member without a `code` (found in 4.4: a code-search test silently searched for `null`). After 3.1 every real member has a code, so the fixture should give its member one (e.g. `generateMemberCode(fixtureCodePrefix(organization.id))`); then `relation-actions.test.ts` can expect a real code instead of `code: null`
- [x] 8.3 `pnpm audit:viewport` exits 1 on `/dashboard/kegiatan?view=calendar&range=bulan` (768x1024 and 1024x768): `span.text-[9px]` "+N lagi" overflow label in `app/dashboard/kegiatan/activity-calendar.tsx:218` is 9px, needs 14px (CLAUDE.md small-text rule; other `text-[9px]` badges in that file at lines 195-210 may need `data-small-text-ok`). Not related to this change (file untouched); found while running 6.3. All member detail pages and the Keluarga dialog flow had no findings
- [x] 8.4 Keluarga card (found in review of 6.2): the "Tambah keluarga" button wrapped under the title (`CardHeader` is a grid, `flex-row` had no effect) and each relative took three stacked lines. Use `CardAction` and one compact line per relative (label · name · group · ×)
- [x] 8.5 `TabNav` shows a vertical scrollbar next to the tabs on detail pages (found in review of 6.2): the link's `-mb-px` pushes its 2px underline 1px below the `overflow-x-auto` strip, which makes the strip scroll vertically (and clips the underline). Drop `-mb-px` in `components/tab-nav.tsx`
