# Tasks

## 1. Schema & migration

- [x] 1.1 Add `Organization.memberCodePrefix String? @unique`, `Member.code String? @unique` and the `MemberRelation` model (design §1, §4); `pnpm prisma migrate dev` succeeds on a seeded dev DB with existing rows
- [x] 1.2 Add `RELATION_TYPES`/`RelationType` to `lib/validation/enums.ts` and `RELATION_MAX_PER_MEMBER`, `RELATION_PICKER_LIMIT`, `MEMBER_CODE_LENGTH`, `MEMBER_CODE_MAX_ATTEMPTS` to `lib/constants.ts`; `pnpm tsc --noEmit` passes

## 2. Pure logic (tests first)

- [ ] 2.1 `lib/member/code.ts`: `generateMemberCode(prefix, random)` and `normalizeMemberCode(input)` with tests for shape, alphabet, lowercase, missing dash, `O/I/L` mapping, invalid input → `null`
- [ ] 2.2 Prefix validation in zod (`^[A-Z]{2,4}$`) with tests for valid, digits, too long, lowercase
- [ ] 2.3 `lib/member/relations.ts`: `canonicalPair(type, a, b)` and `relationLabel(type, side, relativeSex)`, plus section ordering, with tests covering every row of the spec's type table

## 3. Member code assignment

- [ ] 3.1 `createMember` assigns a code with collision retry; the client `code` is ignored; an org without a prefix gives a generic error; tests in `lib/member/mutations.test.ts` (shape, collision retry via forced duplicate, ignored client value, unchanged on update, snapshot contains code)
- [ ] 3.2 CSV import assigns distinct codes within its transaction and ignores a `kode` column; import action test with 40 rows
- [ ] 3.3 `provisionOrganization` + `from-env.ts` accept `BOOTSTRAP_MEMBER_CODE_PREFIX`; invalid or duplicate prefix fails atomically; provision tests
- [ ] 3.4 `scripts/member-codes-backfill.ts` + `pnpm member-codes:backfill` (args `orgId=PREFIX`, refuses partial coverage, batches, `member.code_backfill` audit, idempotent); test on a temp DB: run twice, second run changes nothing
- [ ] 3.5 Seed sets prefixes for both orgs and codes for all members; `pnpm prisma db seed` then no `code IS NULL` rows

## 4. Relationships server side

- [ ] 4.1 `member.relate` in `lib/authz.ts` (both members non-deleted and in scope) with authz tests including the denied cases from the spec
- [ ] 4.2 `linkMembers` / `unlinkMembers` server actions: resolve both ids, validate pair rules (self, deleted, existing relation in either direction, max per member), transaction + `member.relate`/`member.unrelate` audit; cross-scope and cross-org tests return 404 and write nothing
- [ ] 4.3 `getMemberRelatives(session, memberId)` query: hides soft-deleted relatives, strips `id` and extra fields for out-of-scope relatives; test asserts no phone, address or birth date in the payload
- [ ] 4.4 `searchRelativeCandidates`: scope-filtered, excludes self, limit, matches name or normalized code; tests for out-of-scope name and code

## 5. Search & column

- [ ] 5.1 Member list search adds `OR code = normalizeMemberCode(q)` within scope; `lib/member/queries.test.ts` covers the spec scenarios
- [ ] 5.2 Add the `kode` column ("Kode", hidden by default) to `lib/member/columns.ts` and render it in the member table and member views; column tests updated

## 6. UI

- [ ] 6.1 Member detail header shows the code (copyable); page test checks it renders
- [ ] 6.2 Keluarga section + "Tambah keluarga" dialog (type/direction in plain words, member picker) + remove with confirmation, using `useKeepValues` for the form; DOM tests for in-scope link vs out-of-scope plain text and the empty state
- [ ] 6.3 `pnpm audit:viewport` covers the member detail page with relatives and the open dialog; exit 0

## 7. Docs & verification

- [ ] 7.1 DESIGN.md: §2 model + notes, §3.2 matrix row, §4.5 audit actions, §7 member detail page, new §14 Relasi & kode anggota (incl. "code is not an authenticator"), §10 relations row removed; DEPLOYMENT.md backfill step
- [ ] 7.2 `pnpm lint && pnpm tsc --noEmit && pnpm test` all pass; manual check on `pnpm dev:scratch`: link a parent across two kelompok as desa admin, view as kelompok USER, search by code
