# Tasks

## 1. Data model

- [x] 1.1 Add `Tag`, `MemberTag`, `ActivityTag` to `prisma/schema.prisma` (design D1) with relations on `Group`, `User`, `Member`, `Activity`; run `pnpm prisma migrate dev --name tags` and verify the migration only creates three tables and indexes
- [x] 1.2 Add `TAG_COLORS`, `TAG_MAX_PART_LENGTH`, `TAG_MAX_PER_GROUP`, `TAG_MAX_PER_ENTITY`, `MAX_TAG_FILTER_IDS` to `lib/constants.ts` and `TagColor` to `lib/validation/enums.ts`; verify `pnpm tsc --noEmit`
- [x] 1.3 Seed: a few tags (simple + key-value, desa- and kelompok-owned, one in the second org) with links; verify `pnpm prisma db seed` runs on a fresh DB

## 2. Pure logic (tests first)

- [x] 2.1 `lib/validation/tag.ts`: zod schemas + `parseTagInput("a:b")` normalization (trim, lowercase, charset, length, single `:`); verify with `lib/validation/tag.test.ts` covering the naming scenarios in specs/tags
- [x] 2.2 `lib/tag/access.ts`: `canViewTag`, `canUseTag`, `canTagMember`, `canTagActivity`, `visibleTagWhere` (design D3); verify with tests for ancestor/descendant/sibling/other-org cases
- [x] 2.3 `lib/tag/exclusive.ts`: given current links and a new tag, compute links to remove (same owner + key, value tags only); verify tests for replace, no-op, simple tags, same key from sibling owners
- [x] 2.4 Extend `authorize()` with `tag.manage` and `tag.use` (primary role only for manage; extra roles ignored); verify `lib/authz.test.ts` incl. 403 cases for USER, ancestor ADMIN, descendant ADMIN

## 3. Server: tags and links

- [x] 3.1 `resolveTag` / `resolveVisibleTags` in `lib/resolve.ts` (404 when not visible/deleted/other org; list variant drops); verify `lib/resolve.test.ts`
- [x] 3.2 `lib/tag/mutations.ts`: create, rename (key rename = updateMany; separate `renameTagKey` / `renameTagValue`), recolor, soft delete (`deleteTag` one row, `deleteTagKey` = all values) with ancestor-chain uniqueness, simple-vs-key conflict, `TAG_MAX_PER_GROUP`, audit `tag.*`; verify `mutations.test.ts` for every scenario in specs/tags
- [x] 3.3 `attachMemberTag` / `detachMemberTag` / `attachActivityTag` / `detachActivityTag` with exclusivity in-transaction, `TAG_MAX_PER_ENTITY`, idempotent attach (no audit), audit `member.tag/untag`, `activity.tag/untag`; verify tests for specs/tag-assignment scenarios
- [x] 3.4 `bulkTagMembers(session, { memberIds, tagId, op })`: resolve all ids, reject whole batch on any failure, one audit entry with `memberIds` (changed members only) and `replacedLinks` (`{memberId, tagId}` pairs); no-op members skipped, any cap overflow rejects the batch; verify tests (bulk replace, one out-of-scope id rejects all, cap `PAGE_SIZE`)
- [x] 3.5 `splitActivity` copies tag links to the new activity in the same transaction; verify existing split test extended
- [x] 3.6 Group delete emptiness check includes non-deleted owned tags; verify `lib/group/mutations.test.ts`
- [x] 3.7 Add tag cases to `lib/isolation.test.ts` (org B cannot see/use/filter org A tags)

## 4. Server: filtering and queries

- [x] 4.1 Parse `tag` in `lib/filters.ts` (`parseTagIds`, sharing a private `parseIdList` with `parseGroupIds`) (comma ids, cap `MAX_TAG_FILTER_IDS`); verify `lib/filters.test.ts`
- [x] 4.2 Member list query: any-of tag filter + include visible tag links; verify `app/dashboard/anggota/page.test.ts` / queries test (any-of, scope not widened, invisible id dropped) and add a `lib/isolation.test.ts` case that filtering by org B's tag id returns no org B member (the "filter" half of 3.7 needs this query)
- [x] 4.3 Activity list/calendar: filter entries by tag after conflict detection (same place as `q`), conflicts unchanged, include visible links; verify `app/dashboard/kegiatan/page.test.ts`
- [ ] 4.4 Print page accepts `tag`, "Cetak" link carries it; verify print tests for the modified activity-schedule-print scenarios
- [ ] 4.5 Query listing tags visible to the user (for filter) and usable (for picker), grouped by owner; verify unit test

## 5. UI

- [ ] 5.1 `components/tags/tag-chip.tsx` with palette classes and print styles; verify `*.test.tsx` renders text + color class
- [ ] 5.2 `components/tags/tag-picker.tsx` (combobox, `key:value` search, owner labels, "Buat tag" for ADMIN+, optimistic attach/detach); verify jsdom test: USER has no create option, ADMIN create-and-attach calls the action
  - [ ] 5.2a Mobile/tablet: picker opens as a bottom sheet (or full-width popover) at phone width; options and "Buat tag" row ≥ 44px, search input 16px (no iOS zoom), list scrolls inside the viewport above the on-screen keyboard; verify at 375px and 768px in `pnpm dev:scratch`
- [ ] 5.3 Member detail and activity detail: chips + picker in header area; verify by `pnpm dev:scratch` and attaching/removing a tag on each
- [ ] 5.4 Member table: "Tag" column (default, hideable via `lib/member/columns.ts`), per-row picker; activity list rows show chips + picker; verify column test and manual check
  - [ ] 5.4a Mobile/tablet: the Tag column does not break the member table at phone width (chips wrap or truncate with "+N", no horizontal page scroll beyond the table's own scroll container); tap targets ≥ 44px
- [ ] 5.5 Member table bulk selection + action bar "Tambah tag" / "Hapus tag", cleared on page change; verify jsdom test and manual check on phone width
  - [ ] 5.5a Mobile/tablet: checkboxes have a ≥ 44px hit area; the action bar is sticky at the bottom, respects safe-area inset, does not cover the pager or the last row; selection count readable at 375px
- [ ] 5.6 Tag filter in `components/filters/filter-bar` for anggota and kegiatan (multi-select chips grouped by owner); verify URL updates and page resets to 1
  - [ ] 5.6a Mobile/tablet: tag filter fits the filter bar at phone width (collapses into a sheet/popover, selected chips wrap), usable one-handed; verify at 375px and 768px
- [ ] 5.7 Group detail `?tab=tag`: list owned tags grouped by key; create / rename key / recolor / delete dialog for ADMIN+ of that group only; verify tab hidden controls for USER and ancestor ADMIN
  - [ ] 5.7a Mobile/tablet: dialogs fit 375px without clipping (scroll inside, buttons reachable), color swatches ≥ 44px tap targets with a visible selected state, tab bar still scrolls with the new "Tag" tab
- [ ] 5.8 Audit viewer labels for `tag.*`, `member.tag/untag`, `activity.tag/untag`; verify audit page test

## 6. Docs and verification

- [ ] 6.1 DESIGN.md already updated in this change (§2, §3.2, §4.5, §7, §10, §13); re-check it matches the final implementation
- [ ] 6.2 `pnpm lint && pnpm tsc --noEmit && pnpm test` pass
- [ ] 6.3 `pnpm audit:viewport` passes (picker, bulk bar, filter at phone/tablet widths) and `pnpm audit:print` passes with a tag filter

## 7. Mobile and tablet excellence

- [ ] 7.1 Extend `pnpm audit:viewport` scenarios to cover the tag picker, bulk action bar, tag filter, group tag tab and tag dialogs at phone (375×812), small tablet (768×1024) and landscape phone (812×375); fails on horizontal overflow, targets < 44px, text < 16px in inputs
- [ ] 7.2 Manual pass on phone width in `pnpm dev:scratch`: tag a member, tag an activity, bulk-tag 3 members, filter by two tags, create/recolor/delete a tag — note every friction point; fix or add as tasks in section 8
- [ ] 7.3 Manual pass on tablet width (portrait and landscape) of the same flows, including chips on the activity calendar and list
- [ ] 7.4 Chips stay readable at small sizes: contrast of every `TAG_COLORS` entry checked in light mode, text never colour-only, long `key:value` truncates with full text available (title/aria-label)
- [ ] 7.5 Keyboard and screen reader: picker is a proper combobox (role, `aria-expanded`, focus returns to trigger), chips have accessible names, bulk bar announces count

## 8. Additional tasks (failures and findings during implementation)

<!-- Add one line per failure/finding: `- [ ] 8.N <what failed> (found in task X.Y); verify <how>` -->
- [x] 8.1 Spec scenarios "member outside the tag group's subtree" and "activity in an unrelated branch" cannot reach the fit check through the public API: a usable tag (owner is ancestor-or-self of the user) plus an in-scope member or visible activity already implies the fit, so they surface as 404 (sibling) instead. The check stays as defense in depth in `lib/tag/assign.ts`; revisit if `canTagMember`/`canTagActivity` get callers outside this flow (found in 3.3); verify by `lib/tag/assign.test.ts` sibling 404 cases
