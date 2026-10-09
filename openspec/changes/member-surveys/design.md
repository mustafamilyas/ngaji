# Design

## Context

See proposal.md for motivation and the specs for requirements. The app already has the building blocks surveys need: materialized-path scope (`lib/scope.ts`), activity-style inheritance (§3.3 — visible = ancestor-or-scope, edit = owning group only, record = in X or below), `authorize()` with typed targets (`lib/authz.ts`), `audit(tx, …)`, the standard filter bar / pager (§7.1), and the member autocomplete from the check-in page (`app/kegiatan/[id]/[tanggal]/absen/autocomplete.tsx`). SQLite with Prisma 7: no enums, no scalar lists, JSON columns available.

## Goals / Non-Goals

**Goals:** reuse the activity permission model verbatim; keep statistics computable with grouped queries; keep forms stable once answered without full versioning.

**Non-Goals:** public/self-service survey links, open/closed states, repeatable responses per member, conditional/branching questions, file uploads, export (needs a PII policy, DESIGN.md §10), copying a survey to a new round (can come later as "duplikat").

## Decisions

### Normalized answers, not a JSON blob
`SurveyAnswer(responseId, questionId, optionId?, numberValue?, textValue?)` with one row per selected option for `MULTI_CHOICE`. Choice counts become `groupBy(optionId)`, number stats become `_avg/_min/_max` — no JSON parsing in SQLite and filters (population, demographics) are plain joins through `SurveyResponse → Member`. *Alternative*: `SurveyResponse.answers Json` — simpler writes, but every statistic would load all responses into memory and re-validate shape. Rejected.

### Options are rows with stable ids
`SurveyOption(questionId, order, label, archivedAt)`. Answers reference `optionId`, so renaming an option relabels historical answers (intended: typo fixes) and archiving keeps counts. *Alternative*: options as a JSON array on the question and answers storing the label — renames would split counts. Rejected.

### "Lock once answered" instead of versions
The lock is per question/option and derived from data (`exists SurveyAnswer where questionId/optionId`), not a stored flag, so there is no state to drift. A pure function `planFormUpdate(current, submitted, answeredQuestionIds, answeredOptionIds)` diffs the submitted form against the current one and returns either the operations (create / update / archive / hard-delete-unanswered) or the list of violations (type change, scale range change on answered question). Removing an unanswered question/option deletes it (it never held data); removing an answered one archives it. *Alternative*: immutable form versions with responses pinned to a version — correct but much heavier UI and statistics; rejected per product decision.

Form edits are submitted as one whole-form payload per save (one `survey.update` audit entry with before/after form snapshots), not per-question actions — matches react-hook-form with a field array and keeps the audit trail readable.

### Permissions mirror activities
New `authorize` actions with targets shaped like the existing ones:
- `survey.view` → `{ surveyGroupPath }`, same rule as `activity.view` (ancestor of user's group or in scope; otherwise 404).
- `survey.create/update/delete` → `{ groupId }` (`ActivityGroupTarget`): role ≥ ADMIN and `groupId === session.groupId`.
- `survey_response.record/delete` → `{ surveyGroupPath, memberGroupPath, memberIsLeaf }` (like `AttendanceTarget`). Member `AKTIF` is checked in the action, not in `authorize`, since it is a data rule rather than a permission.
`resolveSurvey(session, id)` in `lib/resolve.ts` loads the survey (`deletedAt: null`) with its group path and applies `survey.view`, so every page and action starts from a resolved, visible survey.

### Response save is replace-all
Saving a response: resolve survey + member → authorize → validate answers with a pure `validateAnswers(questions, submitted, existingAnswers)` → transaction: upsert `SurveyResponse(surveyId, memberId)` (update `recordedById`), delete its answers for **non-archived** questions, insert the new ones, `audit('survey_response.save', before, after)`. Answers to archived questions/options are left untouched (spec: archived answers survive an edit). The unique `(surveyId, memberId)` index makes concurrent first saves fail cleanly instead of duplicating.

### Statistics in `lib/survey/stats.ts`
1. Build the population `MemberWhereInput`: `deletedAt: null`, `group.path startsWith G.path` **and** `startsWith X.path`, plus demographic filters (age bracket → `birthDate` range computed from today in Asia/Jakarta with `lib/dates.ts`).
2. Response rate: count members `{population, status: AKTIF}` and those with a response.
3. Per question: `groupBy` on `SurveyAnswer` filtered by `response.member` ∈ population — choices by `optionId`, scale by `numberValue`, number via aggregate; text answers paginated per question (`?teks<qid>=` page params would be awkward, so text lists use one `?teks=<qid>:<page>` param — only one text list paginates at a time).
4. Sub-group breakdown: same queries grouped by the member's group path prefix of each direct child (fetch members' `groupId` + children paths, bucket in memory — sizes are small: one org).
Pure helpers (`summarizeChoice`, `summarizeScale`, `ageBracketRange`) are unit-tested; the query layer gets DB tests like `stats.queries.test.ts`.

### Enums and validation
`lib/validation/enums.ts` gains `QuestionType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'NUMBER' | 'SCALE' | 'SHORT_TEXT' | 'LONG_TEXT'`. `lib/validation/survey.ts` holds the form schema (shared by builder and action) and the per-type answer schema. Limits (`SURVEY_TITLE_MAX`, `SHORT_TEXT_MAX = 200`, `LONG_TEXT_MAX = 2000`, `SCALE_MAX_STEPS = 11`, defaults 1–5) go in `lib/constants.ts`.

### Pages
- `/survei`: Server Component list, standard filter bar (`q`, `grup`), `PAGE_SIZE`. "Buat survei" only for ADMIN+.
- `/survei/baru` and the **Formulir** tab: client form builder (field array, move up/down, type select, option list, Ya/Tidak preset); locked fields render disabled with a hint "sudah ada jawaban".
- `/survei/[id]`: tabs via `?tab=hasil|responden|formulir` (default `hasil`), so the tab state lives in the URL like other filters.
- `/survei/[id]/isi`: member autocomplete reusing the check-in component (extracted to `components/member-autocomplete.tsx` if its props allow; otherwise a sibling), one question per card, sticky save button, "Simpan & anggota berikutnya". Mobile-first.

## Risks / Trade-offs

- [Renaming an answered option changes the meaning of past answers] → hint in the builder ("mengubah label juga mengubah jawaban lama"); the audit log keeps the old label.
- [Statistics over a large org with many questions issue one `groupBy` per question] → acceptable for one organisation in SQLite; batch by type with `questionId IN (...)` if it gets slow.
- [A member who changes leaf group by being recreated (§9.9 PINDAH) loses their response link] → consistent with attendance today; documented, not fixed.
- [Hard delete of responses] → mirrors attendance rows; the full deleted answers are in the audit log so nothing is unrecoverable.
- [Users above X see results only within their scope, which is all of X's subtree; users below X see only their part] → intended (spec "Results respect scope"), stated in the UI as "Data dalam cakupan Anda".

## Migration Plan

One additive Prisma migration (five new tables + relations); no existing table changes beyond relation fields, so rollback = drop the new tables. Seed (development only) adds one desa-level survey with a few questions of each type and responses for some members. `pnpm bootstrap` is unchanged.
