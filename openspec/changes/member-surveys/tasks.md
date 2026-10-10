# Tasks

## 1. Schema & seed

- [x] 1.1 Add `Survey`, `SurveyQuestion`, `SurveyOption`, `SurveyResponse` (`@@unique([surveyId, memberId])`), `SurveyAnswer` + relations on `Group`/`Member`/`User` to `prisma/schema.prisma`; run `pnpm prisma migrate dev --name member_surveys` and verify `pnpm tsc --noEmit` passes
- [x] 1.2 Add `QuestionType` to `lib/validation/enums.ts` and survey limits/defaults to `lib/constants.ts`; verify `pnpm tsc --noEmit`
- [x] 1.3 Seed a desa-level sample survey (one question of each type, an archived option) with responses for some members; verify `pnpm prisma db seed` succeeds on a fresh DB

## 2. Pure logic (tests first)

- [x] 2.1 `lib/validation/survey.ts` form schema (title, question types, ≥2 distinct options, scale bounds/steps, Ya/Tidak preset helper); verify tests for every "Question types" / "Survey fields" scenario pass
- [x] 2.2 `lib/survey/form-plan.ts` `planFormUpdate` (create/update/archive/delete-unanswered, reject type or scale change on answered questions); verify tests for every "Form locks once answered" scenario pass
- [x] 2.3 `lib/survey/answers.ts` `validateAnswers` (foreign/archived ids, per-type rules, required/optional, archived answers preserved); verify tests for every "Answers are validated" scenario pass
- [x] 2.4 `lib/survey/summary.ts` (`summarizeChoice` with multi-choice %, `summarizeScale` with zero buckets, `ageBracketRange` from `AGE_BRACKETS`); verify unit tests pass

## 3. Authorization

- [ ] 3.1 Add `survey.*` / `survey_response.*` actions and targets to `lib/authz.ts`; verify `lib/authz.test.ts` covers every scenario in the authorization delta, including denied (403) and out-of-scope (404) cases
- [ ] 3.2 Add `resolveSurvey` (and member-for-survey resolution) to `lib/resolve.ts`; verify tests: deleted survey → 404, other branch → 404, inherited → resolved

**Checkpoint**: `pnpm test` green; cross-scope survey access fails closed.

## 4. Survey CRUD & form builder

- [ ] 4.1 `lib/survey/mutations.ts` create / update (applies `planFormUpdate`) / soft delete, each with `audit()` in the same transaction; verify DB tests (owner admin ok, USER/ancestor/descendant denied, audit rollback)
- [ ] 4.2 `lib/survey/list.ts` visible surveys with search, group filter, pagination, response count, inherited flag; verify DB tests incl. scope
- [ ] 4.3 `/survei` list page + nav item "Survei" in `lib/nav.ts`; verify page test renders list and hides "Buat survei" for USER
- [ ] 4.4 Form builder component + `/survei/baru` + "Formulir" tab on `/survei/[id]` (locked fields disabled with hint, read-only for non-owners); verify page tests and manually in the browser preview (create survey, add each type, reorder, archive)

## 5. Responses

- [ ] 5.1 `lib/survey/responses.ts` save (replace-all except archived, upsert, `survey_response.save` audit with before/after) and delete (`survey_response.delete`); verify DB tests for every "survey-responses" scenario (inactive member rejected, ancestor denied, overwrite, delete audited)
- [ ] 5.2 `/survei/[id]/isi` entry page with member autocomplete (reuse/extract from check-in), prefill via `?anggota=`, "Simpan & anggota berikutnya"; verify page test and in the preview at mobile width
- [ ] 5.3 "Responden" tab (scope-filtered list, search, group filter, pagination, edit link, delete with confirm); verify page test shows only in-scope respondents

## 6. Statistics

- [ ] 6.1 `lib/survey/stats.ts` population (G ∩ X subtree, demographics), response rate, non-respondents, per-question aggregates, text pagination, sub-group breakdown; verify DB tests for every "survey-statistics" scenario
- [ ] 6.2 "Hasil" tab: single group filter (default per spec), demographic filters, rate + "Belum mengisi", per-question charts (Recharts) and text lists, breakdown table; verify page test and visually in the preview

## 7. Docs & wrap-up

- [ ] 7.1 Update DESIGN.md: §2 schema, §3.2 matrix, §3.5 actions, §4.5 audit table, §7 pages, new §11 Survei (decisions from this change); verify sections match the specs
- [ ] 7.2 Run `pnpm test && pnpm tsc --noEmit && pnpm lint` and `openspec validate member-surveys`; verify all pass (note any pre-existing lint failure)
