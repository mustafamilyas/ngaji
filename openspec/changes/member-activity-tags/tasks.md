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
- [x] 4.4 Print page accepts `tag`, "Cetak" link carries it; verify print tests for the modified activity-schedule-print scenarios
- [x] 4.5 `listTags` in `lib/tag/list.ts`: tags visible to the user (for filter) and usable (for picker), grouped by owner (own group, ancestors nearest-first, descendants); verify unit test

## 5. UI

- [x] 5.1 `components/tags/tag-chip.tsx` with palette classes and print styles; verify `*.test.tsx` renders text + color class
- [x] 5.2 `components/tags/tag-picker.tsx` (combobox, `key:value` search, owner labels, "Buat tag" for ADMIN+, optimistic attach/detach); verify jsdom test: USER has no create option, ADMIN create-and-attach calls the action
  - [x] 5.2a Mobile/tablet: picker opens as a bottom sheet (or full-width popover) at phone width; options and "Buat tag" row ≥ 44px, search input 16px (no iOS zoom), list scrolls inside the viewport above the on-screen keyboard; verify at 375px and 768px in `pnpm dev:scratch`
- [x] 5.3 Member detail and activity detail: chips + picker in header area; verify by `pnpm dev:scratch` and attaching/removing a tag on each
- [x] 5.4 Member table: "Tag" column (default, hideable via `lib/member/columns.ts`), per-row picker; activity list rows show chips + picker; verify column test and manual check
  - [x] 5.4a Mobile/tablet: the Tag column does not break the member table at phone width (chips wrap or truncate with "+N", no horizontal page scroll beyond the table's own scroll container); tap targets ≥ 44px
- [x] 5.5 Member table bulk selection + action bar "Tambah tag" / "Hapus tag", cleared on page change; verify jsdom test and manual check on phone width
  - [x] 5.5a Mobile/tablet: checkboxes have a ≥ 44px hit area; the action bar is sticky at the bottom, respects safe-area inset, does not cover the pager or the last row; selection count readable at 375px
- [x] 5.6 Tag filter in `components/filters/filter-bar` for anggota and kegiatan (multi-select chips grouped by owner); verify URL updates and page resets to 1
  - [x] 5.6a Mobile/tablet: tag filter fits the filter bar at phone width (collapses into a sheet/popover, selected chips wrap), usable one-handed; verify at 375px and 768px
- [x] 5.7 Group detail `?tab=tag`: list owned tags grouped by key; create / rename key / recolor / delete dialog for ADMIN+ of that group only; verify tab hidden controls for USER and ancestor ADMIN
  - [x] 5.7a Mobile/tablet: dialogs fit 375px without clipping (scroll inside, buttons reachable), color swatches ≥ 44px tap targets with a visible selected state, tab bar still scrolls with the new "Tag" tab
- [x] 5.8 Audit viewer labels for `tag.*`, `member.tag/untag`, `activity.tag/untag`; verify audit page test

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
- [x] 8.2 Picker empty state is unhelpful: with no usable tags the sheet shows only "Tidak ditemukan." even for an ADMIN who could create one (e.g. root admin whose visible tags all belong to descendants) (found in 5.2a, browser pass at 375px); show a hint such as "Ketik nama untuk membuat tag" when `canCreate`, and "Belum ada tag yang bisa dipakai" otherwise; verify by `tag-picker.test.tsx` empty-state cases
- [x] 8.3 (could not be reproduced with a real click: the field was already focused, and a touch open leaves it unfocused; the rule is now explicit in `TagOverlay`, `initialFocus` = not touch, with focus tests) Bottom sheet does not focus the search field on open: the first characters typed after opening went nowhere (found in 5.2a, browser pass at 375px); decide per device (autofocus raises the on-screen keyboard on phones, which may hide the list) and make keyboard users land in the field; verify by jsdom focus test and manual pass at 375px/768px (also covers 7.5 "focus")
- [ ] 8.4 Sheet height vs the on-screen keyboard is only checked by emulation (`max-h-[70dvh]`); real iOS/Android keyboards are not covered (found in 5.2a); verify on a real phone during 7.2 and adjust the sheet height/`interactive-widget` if the list is hidden
- [x] 8.5 Picker showed a remove (×) on every attached tag, including visible tags the user cannot use (e.g. a descendant group's), so removing one would 403 (found in 5.3); × now only on tags in the usable options and the chip stays read-only otherwise; verify by `tag-picker.test.tsx` and the member/activity page tests
- [ ] 8.6 Existing page tests render with synchronous `renderToStaticMarkup`, so async server components cannot be used inside pages; tag data is loaded by `lib/tag/entity.ts` and passed to a synchronous `EntityTags` (found in 5.3). Reuse this pattern for 5.4–5.6 instead of async components
- [x] 8.7 Adding `tag` to `MEMBER_COLUMNS` also made it a view column: `lib/member-view/results.ts` typed every column as session-independent and `memberSelectFor` had no session (found in 5.4); the Tag column is now supported in saved views as read-only chips (`PreparedView.select`), docs and tag-filter spec updated, tag rules in view filters stay deferred; verify by `results.test.ts`, `view-table.test.tsx`
- [x] 8.8 Tag cell was too narrow at 768px: three chips stacked into a 121px row (found in 5.4a, browser pass at 768px); widened to `md:min-w-72` (row 93px); verify by measuring rows on `/dashboard/anggota` at 768px
- [ ] 8.9 In the activity list a row with no tags shows only a bare "+" icon, indented and without a visible label, so on a phone it reads as a stray symbol (found in 5.4a, browser pass at 375px); show a visible "Tag" label or align the icon with the row text; verify by screenshot at 375px and 768px
- [ ] 8.10 The compact "+" picker has no per-row feedback for a pending change beyond the optimistic chip, and chips in rows are read-only, so removing a tag takes two taps (open sheet, choose the tag again) (found in 5.4); decide in the 7.2/7.3 manual passes whether rows need a quicker remove
- [ ] 8.11 On a phone (375px) the bulk bar is 121px tall (about 15% of the screen): "Tambah tag" wraps onto a second line with "Hapus tag" and "Batal", and it covers the select-all row while scrolling (found in 5.5a, browser pass); make it one compact row (e.g. icon-only "Batal") or collapse the actions, keeping 44px targets; verify by measuring the bar at 375px
- [x] 8.12 Bulk selection appears only when the user has at least one usable tag, not "use or create" as first agreed: an ADMIN with zero tags would get a bar whose chooser is empty (found in 5.5); they create the first tag from a row or the detail page; revisit if that is too hidden
- [ ] 8.13 Clearing the selection on a page/filter/sort change is covered by a test (provider `key` = the page's member ids) but was not seen in the browser, since the seed has fewer than `PAGE_SIZE` members (found in 5.5); verify by hand with 51+ members during 7.2
- [ ] 8.14 The existing group filter popover is not touch-sized: its search field is `h-8 text-sm` and its rows about 32px, next to the new tag filter whose controls are 44px/16px (noticed in 5.6 while reading `components/filters/group-filter.tsx`; not measured in the browser); bring it to the primitives' touch sizes below `xl`; verify by measuring the popover at 375px and by `pnpm audit:viewport`
- [x] 8.15 Menu items of the shared `DropdownMenuItem`/`DropdownMenuLinkItem` are about 30px tall with 14px text, below the 44px/16px touch rule (found in 5.7a, browser pass at 375px); the new tag menus size their own items (`min-h-11 text-base xl:min-h-0 xl:text-sm`); verify by `tag-manage.test.tsx` and measuring the menu at 375px
- [ ] 8.16 The shared dropdown primitive itself is still not touch-sized, so `RowActions` kebab menus in every table (members, activities, groups, users) have 30px items on phones (found in 5.7a, see 8.15); give `itemClass` in `components/ui/dropdown-menu.tsx` the same touch sizes and re-run `pnpm audit:viewport`; verify by measuring a table row menu at 375px
