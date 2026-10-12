# Tasks

## 1. Schema & constants

- [x] 1.1 Add `MemberView` (`groupId`, `ownerId`, `createdById`, `name`, `source`, `visibility`, `definition` Json, `deletedAt`, timestamps, `@@index([groupId, deletedAt])`) + relations on `Group`/`User` to `prisma/schema.prisma`; run `pnpm prisma migrate dev --name member_views` and verify `pnpm tsc --noEmit` passes
- [x] 1.2 Add `VIEW_SOURCES` / `VIEW_VISIBILITIES` to `lib/validation/enums.ts` and `VIEW_MAX_RULE_GROUPS`, `VIEW_MAX_RULES_PER_GROUP`, `VIEW_MAX_AGE_BUCKETS`, `VIEW_SECTION_PAGE_SIZE`, `VIEW_EXPANDED_SECTIONS`, `VIEW_MAX_DRAFT_LENGTH` to `lib/constants.ts`; verify `pnpm tsc --noEmit`

## 2. Pure logic (tests first)

- [x] 2.1 `lib/member-view/fields.ts` field registry (types, operators, sortable/groupable; no phone/address/email); verify a test asserts the PII fields are absent from rules, sort and group-by
- [x] 2.2 `lib/member-view/age.ts` age → birth-date bounds for every age operator; verify a property test agrees with `ageInYears` for every day across leap years (incl. Feb 29 birthdays) and the "Age is computed" scenarios pass
- [x] 2.3 `lib/validation/member-view.ts` definition schema with strict (save) and lenient (load/draft, returns warnings) parsing, limits, bucket overlap check, view name schema; verify tests for every "Definition shape", "Fields and operators", "PII fields" and bucket scenario
- [x] 2.4 `lib/member-view/query.ts` `buildWhere` / `buildOrderBy` (AND/OR, text, choice, dates, within-last-N-days, age, group subtree, tie-breaker, age sort flip); verify unit tests on the generated Prisma input
- [ ] 2.5 `lib/member-view/draft.ts` encode/decode `?d=` (base64url, length limit, lenient parse); verify tests for round-trip, oversize and tampered input

## 3. Authorization & resolution

- [ ] 3.1 Add `member_view.*` actions and the resolved view target (`groupId`, `ownerId`, `ownerIsActive`, `ownerGroupId`) to `lib/authz.ts`; verify `lib/authz.test.ts` covers every scenario in the authorization delta (404 for ancestor/descendant/other branch, 403 for non-owner and non-orphan transfer)
- [ ] 3.2 Add `resolveMemberView` to `lib/resolve.ts` and group-ID resolution for definitions (strict reject / lenient drop); verify tests: deleted view → 404, deleted or out-of-scope group handled per mode

**Checkpoint**: `pnpm test` green; cross-group view access fails closed.

## 4. Queries & mutations

- [ ] 4.1 `lib/member-view/results.ts` scoped list (`deletedAt: null` + scope AND `buildWhere`), total count, `PAGE_SIZE` pagination; verify DB tests for "Results are scope-limited" and age/AND/OR scenarios against seeded members
- [ ] 4.2 `lib/member-view/sections.ts` section counts + per-section pages for property, age buckets (+ "Lainnya") and org level (roll-up by path, level bounds); verify DB tests for every "Group by" and "Grouped and ungrouped result display" scenario
- [ ] 4.3 `lib/member-view/mutations.ts` create (group from session) / update / soft delete / transfer, each with `audit()` in the same transaction; verify DB tests: owner ok, non-owner 403, duplicate name rejected, deleted name reusable, takeover rules, audit before/after/meta, audit failure rolls back
- [ ] 4.4 `lib/member-view/list.ts` views of the user's exact group with search and pagination; verify DB test that ancestor/descendant views are never listed
- [ ] 4.5 Seed two sample views (age buckets; org-level grouping) for a desa; verify `pnpm prisma db seed` succeeds on a fresh DB

## 5. Pages

- [ ] 5.1 `/tampilan` list page + sidebar item "Tampilan" in `lib/nav.ts`; verify page test renders only own-group views
- [ ] 5.2 `/tampilan/[id]` + `/tampilan/baru` result rendering (ungrouped table with columns from the definition, grouped collapsible sections with counts and "Tampilkan lebih banyak" server action, stale-rule notice); verify page tests incl. hidden PII column not in the response
- [ ] 5.3 Filter bar (rule groups as chips, AND/OR toggles, per-type operator/value inputs, mobile sheet) and "Tampilan" menu (group-by incl. age bucket editor from `AGE_BRACKETS`, sort, columns) writing the `?d=` draft; verify in the browser preview at desktop and mobile width
- [ ] 5.4 Header actions: "Simpan" / "Batalkan" (owner), "Simpan sebagai baru" dialog, rename dialog, "Ambil alih" (ADMIN+, orphaned), danger zone delete; verify page tests for control visibility per role/ownership and the full save → reload flow in the preview

## 6. Docs & wrap-up

- [ ] 6.1 Update DESIGN.md: §2 schema, §3.2 matrix, §3.5 actions, §4.5 audit table, §7 pages, new section for member views; add `member_view.*` to `AUDIT_ACTIONS`; verify sections match the specs
- [ ] 6.2 Run `pnpm test && pnpm tsc --noEmit && pnpm lint` and `openspec validate member-views --strict`; verify all pass (note any pre-existing lint failure)
