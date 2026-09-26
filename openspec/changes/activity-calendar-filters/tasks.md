# Tasks

## 1. Date helpers (pure, TDD)

- [ ] 1.1 Add `monthStartOf(date)` / `monthEndOf(date)` to `lib/dates.ts` (calendar-month bounds of the month containing `date`, `YYYY-MM-DD` in/out); unit tests cover a 31-day month, February, and a leap-year February
- [ ] 1.2 Add a small pure helper (e.g. `rangeForMode(mode, today)`) that returns `{ from, to }` for `hari` / `minggu` / `bulan` using `today()`, `sundayOf`, `addDays`, `monthStartOf`/`monthEndOf`; unit tests cover all three modes against a fixed `today`

## 2. Multi-group query (`lib/activity/list.ts`)

- [ ] 2.1 Change `ListActivitiesFilter` from `groupId?: number` to `groupIds?: number[]`; when omitted, default to `[session.groupId]` (preserves current single-group default)
- [ ] 2.2 For each id in `groupIds`, run the existing resolve + related-groups + activity + occurrence pipeline unchanged; catch `NotFoundError` per id and skip that id instead of throwing (out-of-scope ids are dropped, not trusted); if every id is dropped, behave like today's out-of-scope case (`notFound()` from the page)
- [ ] 2.3 Merge per-group `ActivityListEntry[]` results, de-duplicating by `` `${activityId}:${key}` ``, before running conflict detection once over the combined candidate set
- [ ] 2.4 Update `lib/activity/list.test.ts` (or add it if it doesn't exist yet — check first): single-id call still matches current fixtures byte-for-byte; two unrelated groups' results are unioned with no cross-visibility; two groups sharing an ancestor activity produce exactly one entry for it; an out-of-scope id mixed with a valid id returns only the valid id's results

## 3. Page: group filter UI (multi-select + descendant shortcut)

- [ ] 3.1 In `app/kegiatan/page.tsx`, parse `grup` as a comma-separated list of ids instead of a single id; keep backward compatibility with a bare single id
- [ ] 3.2 Build the checkbox-tree group picker from the already-fetched `visibleGroupsWhere` groups (with `path`); add a per-group "pilih dengan turunannya" action that checks that group plus every group whose `path` starts with its `path`
- [ ] 3.3 Wire picker submission to write the selected ids back into the `grup` URL param (comma-separated); verify by rendering the page with `grup=<id1>,<id2>` and asserting both groups' activities appear (extend `page.test.ts`)
- [ ] 3.4 Verify an out-of-scope id in `?grup=` does not crash the page and does not leak that group's activities (`page.test.ts` case)

## 4. Page: range mode toggle

- [ ] 4.1 Add a `range` URL param (`hari` | `minggu` | `bulan` | `custom`), defaulting to `minggu` when absent (matches current default)
- [ ] 4.2 For `hari`/`minggu`/`bulan`, compute `from`/`to` via `rangeForMode` (task 1.2) instead of reading them from the URL; for `custom`, keep reading `from`/`to` from the URL as today and keep the existing manual date inputs visible only in this mode
- [ ] 4.3 Update prev/next navigation links to step by the active mode's unit (1 day / 7 days / 1 calendar month via `addMonthsOnDay`-based month arithmetic or `monthStartOf`/`monthEndOf` of the shifted month) and hide them in `custom` mode
- [ ] 4.4 Extend `page.test.ts`: rendering with `range=hari`, `range=bulan`, and `range=custom&from=...&to=...` each produce the expected effective range (assert via rendered date labels or exposed test hook)

## 5. Calendar view

- [ ] 5.1 Add a calendar rendering path in `app/kegiatan/` (e.g. `activity-calendar.tsx`) that takes the same `entries` used by the list and lays them into a Sunday-start month grid keyed by `effectiveDate`; each day cell shows compact indicators (not full text) reusing the existing badge semantics (warisan/konflik/dipindah/batal)
- [ ] 5.2 Add a `view` URL param (`list` | `calendar`, default `list`) and a toggle control in the page; both views render from the same fetched `entries`, no second data fetch
- [ ] 5.3 Tapping/clicking a day in the calendar links to the list view scoped to that single day (`?view=list&range=custom&from=D&to=D`) reusing existing filters
- [ ] 5.4 Test: render the page with `view=calendar` and assert the month grid renders with the expected number of day cells and that an occurrence's badges appear in its cell (`page.test.ts`)
- [ ] 5.5 Manual check at 375px width (mobile-first requirement): calendar cells stay legible and tappable, no horizontal overflow — note the result in the PR description since this is a visual check, not an automated one

## 6. Docs sync

- [ ] 6.1 Update `DESIGN.md` §5.3 to describe the multi-group union rule and §7's `/kegiatan` row to mention the view toggle and range mode toggle, matching the specs in this change
- [ ] 6.2 Run `pnpm lint && pnpm tsc --noEmit && pnpm test` and confirm all green before opening the PR
